import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Webhooks need the Node.js runtime and must never be statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body is required for signature verification (do not parse as JSON first).
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: record the event. The unique stripe_event_id makes replays a
  // no-op. A duplicate only means the event was *recorded* — not that it was
  // successfully *handled* (a prior attempt may have inserted the row then
  // failed). So on a duplicate we skip only if processed_at is already set;
  // otherwise we fall through and (re)process. handleEvent is idempotent.
  const { error: insertError } = await supabase
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

  if (insertError) {
    if ((insertError as { code?: string }).code !== "23505") {
      return NextResponse.json(
        { error: "Failed to record event" },
        { status: 500 },
      );
    }
    const { data: existing } = await supabase
      .from("stripe_webhook_events")
      .select("processed_at")
      .eq("stripe_event_id", event.id)
      .single();
    if (existing?.processed_at) {
      // Already fully processed — acknowledge so Stripe stops retrying.
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Recorded but not processed (prior attempt failed) — reprocess below.
  }

  try {
    await handleEvent(supabase, event);
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    // Return 500 so Stripe retries; the recorded row stays unprocessed.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  await supabase
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);

  return NextResponse.json({ received: true });
}

/**
 * Write payment status back to Supabase. Updates are matched by the Stripe IDs
 * stored on the `payments` row when a payment link/checkout session is created.
 * If no row matches yet, the update simply affects 0 rows (safe).
 */
async function handleEvent(supabase: SupabaseClient, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabase
        .from("payments")
        .update({
          status: "succeeded",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
        })
        .eq("stripe_checkout_session_id", session.id);
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("payments")
        .update({ status: "succeeded", paid_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", intent.id);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("stripe_payment_intent_id", intent.id);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === "string") {
        await supabase
          .from("payments")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", charge.payment_intent);
      }
      break;
    }
    default:
      // Other event types are recorded but need no payment-state change.
      break;
  }
}
