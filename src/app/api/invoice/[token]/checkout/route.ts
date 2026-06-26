import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getInvoiceByToken } from "@/lib/invoices/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cents = (n: number) => Math.round(n * 100);
const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

/**
 * Create a Stripe Checkout Session for a token-identified invoice and redirect
 * the client to Stripe. A pending `payments` row is recorded keyed by the
 * session id; the EXISTING webhook (checkout.session.completed → match by
 * stripe_checkout_session_id) then marks it succeeded, backfills the intent,
 * reconciles the invoice, and activates the event — no webhook changes needed.
 *
 * The charge always equals the invoice total (full) or remaining balance
 * (partial), to the cent — line `amount`s are pre-rounded to cents in the DB.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = req.nextUrl.origin;
  const back = `${origin}/i/${encodeURIComponent(token)}`;

  const invoice = await getInvoiceByToken(token);
  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });

  // Nothing left to collect — send them back to the page (which shows status).
  if (
    invoice.balance <= 0 ||
    invoice.status === "void" ||
    invoice.status === "paid"
  ) {
    return NextResponse.redirect(back, 303);
  }

  try {
    const stripe = getStripe();
    const numberLabel = invoice.invoice_number ?? invoice.id.slice(0, 8);

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    if (invoice.amount_paid > 0) {
      // Partial balance already paid by another method: charge only the
      // remaining balance as one line (never re-itemize the full total).
      lineItems = [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents(invoice.balance),
            product_data: { name: `Balance due — Invoice ${numberLabel}` },
          },
        },
      ];
    } else {
      // Itemize each line using its line TOTAL (quantity 1), so the sum equals
      // the invoice subtotal exactly; add tax as its own line.
      lineItems = invoice.line_items
        .filter((l) => l.amount > 0)
        .map((l) => ({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents(l.amount),
            product_data: {
              name:
                l.quantity !== 1
                  ? `${l.description} (${l.quantity} × ${usd(l.unit_price)})`
                  : l.description || "Item",
            },
          },
        }));
      if (invoice.tax > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents(invoice.tax),
            product_data: { name: "Tax" },
          },
        });
      }
      if (lineItems.length === 0) {
        lineItems = [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: cents(invoice.total_amount),
              product_data: { name: `Invoice ${numberLabel}` },
            },
          },
        ];
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${back}?paid=1`,
      cancel_url: back,
      client_reference_id: invoice.id,
      metadata: { invoice_id: invoice.id },
      ...(invoice.client_email
        ? { customer_email: invoice.client_email }
        : {}),
    });

    const db = createServiceClient();
    await db.from("payments").insert({
      invoice_id: invoice.id,
      event_id: invoice.event_id,
      amount: invoice.balance,
      currency: "usd",
      method: "stripe",
      status: "pending",
      stripe_checkout_session_id: session.id,
      notes: "Stripe checkout (invoice page)",
    });

    if (!session.url) return NextResponse.redirect(`${back}?error=checkout`, 303);
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("Invoice checkout error:", e);
    return NextResponse.redirect(`${back}?error=checkout`, 303);
  }
}
