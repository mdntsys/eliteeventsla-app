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
 * Write payment status back to Supabase, then reconcile the parent invoice.
 *
 * Payment links are the tricky case: the `payments` row is created with only
 * `stripe_payment_link_id` (the session/intent ids don't exist until someone
 * pays). So `checkout.session.completed` matches on the payment-link id and
 * backfills the session + intent ids, so any later `payment_intent.*` events for
 * the same payment also match. After updating the payment row(s) we recompute the
 * invoice's amount_paid/status — the webhook uses the service-role client, so it
 * can't reuse the server-action reconcile helper, hence the local copy below.
 */
async function handleEvent(supabase: SupabaseClient, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;
      const paymentLinkId =
        typeof session.payment_link === "string" ? session.payment_link : null;

      const update: Record<string, unknown> = {
        status: "succeeded",
        paid_at: new Date().toISOString(),
        stripe_checkout_session_id: session.id,
      };
      // Backfill the intent id so later payment_intent.* events match this row.
      if (paymentIntentId) update.stripe_payment_intent_id = paymentIntentId;

      // Match the pending row by the payment-link id we stored at creation; fall
      // back to the session id for any directly-created checkout session.
      const invoiceIds = await markPayments(
        supabase,
        paymentLinkId ? "stripe_payment_link_id" : "stripe_checkout_session_id",
        paymentLinkId ?? session.id,
        update,
      );
      await reconcileInvoices(supabase, invoiceIds);
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const invoiceIds = await markPayments(
        supabase,
        "stripe_payment_intent_id",
        intent.id,
        { status: "succeeded", paid_at: new Date().toISOString() },
      );
      await reconcileInvoices(supabase, invoiceIds);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const invoiceIds = await markPayments(
        supabase,
        "stripe_payment_intent_id",
        intent.id,
        { status: "failed" },
      );
      await reconcileInvoices(supabase, invoiceIds);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === "string") {
        const invoiceIds = await markPayments(
          supabase,
          "stripe_payment_intent_id",
          charge.payment_intent,
          { status: "refunded" },
        );
        await reconcileInvoices(supabase, invoiceIds);
      }
      break;
    }
    default:
      // Other event types are recorded but need no payment-state change.
      break;
  }
}

/**
 * Apply `update` to every payments row where `column` = `value`. Returns the
 * distinct invoice ids touched (for reconciliation). Throws on error so the
 * caller returns 500 and Stripe retries.
 */
async function markPayments(
  supabase: SupabaseClient,
  column: string,
  value: string,
  update: Record<string, unknown>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("payments")
    .update(update)
    .eq(column, value)
    .select("invoice_id");
  if (error) throw error;
  return Array.from(
    new Set(
      (data ?? [])
        .map((row: { invoice_id: string | null }) => row.invoice_id)
        .filter((id: string | null): id is string => Boolean(id)),
    ),
  );
}

/**
 * Recompute amount_paid/status for each invoice from its succeeded payments.
 * Mirrors reconcileInvoice() in lib/accounting/actions.ts: never touches
 * draft/void invoices, moves to paid/partial otherwise.
 */
async function reconcileInvoices(
  supabase: SupabaseClient,
  invoiceIds: string[],
): Promise<void> {
  for (const invoiceId of invoiceIds) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("total_amount, status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) continue;

    const { data: pays } = await supabase
      .from("payments")
      .select("amount, status")
      .eq("invoice_id", invoiceId);

    const paid = round2(
      (pays ?? [])
        .filter((p: { status: string }) => p.status === "succeeded")
        .reduce(
          (sum: number, p: { amount: number | null }) => sum + (p.amount ?? 0),
          0,
        ),
    );

    const inv = invoice as { total_amount: number | null; status: string };
    const total = inv.total_amount ?? 0;
    let status = inv.status;
    if (status !== "void" && status !== "draft") {
      if (total > 0 && paid >= total) status = "paid";
      else if (paid > 0) status = "partial";
    }

    await supabase
      .from("invoices")
      .update({ amount_paid: paid, status })
      .eq("id", invoiceId);
  }
}

/** Round to cents to avoid float drift in stored money. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
