import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyBookingConfirmed } from "@/lib/email/send";

/**
 * The single source of truth for "money landed on an invoice".
 *
 * Recomputes the invoice's amount_paid + status from its succeeded payments,
 * then — on the first dollar in — ACTIVATES the linked event (draft → confirmed)
 * and emails the client a booking confirmation. This is the bridge that makes a
 * client payment actually move their job forward in the system.
 *
 * Shared by the manual payment action (lib/accounting/actions.ts) and the Stripe
 * webhook (api/stripe/webhook), so it takes whatever Supabase client the caller
 * already has. Pass a PRIVILEGED client (service role) when the actor may lack
 * events-edit RLS — the event activation is a system side effect of payment, not
 * a user write, so it should not depend on the payer's module permissions.
 *
 * Invoice semantics mirror the original reconcileInvoice: never touches
 * draft/void invoices; moves sent/partial/overdue to paid (paid ≥ total) or
 * partial (paid > 0). Never downgrades (a refund leaves the invoice as-is).
 */

/** Round to cents to avoid float drift in stored money. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type ReconcileResult = {
  /** Final invoice status after reconciliation (null if invoice not found). */
  invoiceStatus: string | null;
  /** Sum of succeeded payments on the invoice. */
  amountPaid: number;
  /** True iff this call moved a draft event to confirmed. */
  eventActivated: boolean;
};

export async function reconcileInvoiceAndActivateEvent(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<ReconcileResult> {
  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id, total_amount, status, event_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoiceRow) {
    return { invoiceStatus: null, amountPaid: 0, eventActivated: false };
  }
  const invoice = invoiceRow as {
    id: string;
    total_amount: number | null;
    status: string;
    event_id: string | null;
  };

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

  const total = invoice.total_amount ?? 0;
  let status = invoice.status;
  if (status !== "void" && status !== "draft") {
    if (total > 0 && paid >= total) status = "paid";
    else if (paid > 0) status = "partial";
    // Bidirectional: a refund that drops succeeded payments back to zero moves a
    // previously paid/partial invoice back to 'sent' (still owed). Leave
    // sent/overdue untouched so a refund doesn't erase an overdue flag.
    else if (status === "paid" || status === "partial") status = "sent";
  }

  await supabase
    .from("invoices")
    .update({ amount_paid: paid, status })
    .eq("id", invoiceId);

  // Activate the linked event on first money in: a deposit (or full payment)
  // confirms a tentative (draft) booking. Never downgrades a further-along event.
  // A voided invoice never activates its event — the booking is cancelled, so a
  // stray payment on a dead link must not confirm it.
  let eventActivated = false;
  if (paid > 0 && invoice.event_id && status !== "void") {
    eventActivated = await activateEvent(supabase, invoice.event_id);
  }

  // Accrue (or reverse) the affiliate commission for this invoice.
  await accrueAffiliateCommission(supabase, invoiceId, status);

  return { invoiceStatus: status, amountPaid: paid, eventActivated };
}

/**
 * Accrue (or reverse) the affiliate commission for one invoice. Commission is
 * earned once the invoice is FULLY paid (contract: "after the Company receives
 * full payment"), computed on the PRE-TAX subtotal at rate = the event's
 * override, else the affiliate's rate. If a commission should NO LONGER exist —
 * the invoice left 'paid' (refund/chargeback), or the event was re-attributed /
 * un-attributed so no affiliate is owed — an OUTSTANDING accrual is reversed; a
 * commission already included in a payout is left untouched for manual clawback.
 * Runs with whatever (privileged) client the reconciler was given.
 */
export async function accrueAffiliateCommission(
  supabase: SupabaseClient,
  invoiceId: string,
  invoiceStatus: string,
): Promise<void> {
  const { data: existingRow } = await supabase
    .from("affiliate_commissions")
    .select("id, status")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  const existing = existingRow as { id: string; status: string } | null;

  // Resolve the commission this invoice SHOULD carry, if any: only a fully-paid
  // invoice, on an event attributed to an existing affiliate, earns one.
  let target:
    | { affiliate_id: string; event_id: string; basis: number; rate: number; amount: number }
    | null = null;

  if (invoiceStatus === "paid") {
    const { data: invRow } = await supabase
      .from("invoices")
      .select("subtotal, event_id")
      .eq("id", invoiceId)
      .maybeSingle();
    const inv = invRow as { subtotal: number | null; event_id: string | null } | null;

    if (inv?.event_id) {
      const { data: evRow } = await supabase
        .from("events")
        .select("affiliate_id, commission_rate_override")
        .eq("id", inv.event_id)
        .maybeSingle();
      const ev = evRow as {
        affiliate_id: string | null;
        commission_rate_override: number | null;
      } | null;

      if (ev?.affiliate_id) {
        const { data: affRow } = await supabase
          .from("affiliates")
          .select("commission_rate")
          .eq("id", ev.affiliate_id)
          .maybeSingle();
        const aff = affRow as { commission_rate: number } | null;

        if (aff) {
          const rate = ev.commission_rate_override ?? aff.commission_rate;
          const basis = round2(inv.subtotal ?? 0);
          target = {
            affiliate_id: ev.affiliate_id,
            event_id: inv.event_id,
            basis,
            rate,
            amount: round2(basis * rate),
          };
        }
      }
    }
  }

  if (target) {
    if (!existing) {
      await supabase.from("affiliate_commissions").insert({
        affiliate_id: target.affiliate_id,
        event_id: target.event_id,
        invoice_id: invoiceId,
        basis_amount: target.basis,
        rate: target.rate,
        amount: target.amount,
        status: "accrued",
      });
    } else if (existing.status !== "paid") {
      // Re-accrue: a reversed→repaid invoice, or an affiliate/rate/basis change
      // while the commission has not yet been paid out. A paid-out commission is
      // left as-is (its clawback/re-attribution is a manual accounting matter).
      await supabase
        .from("affiliate_commissions")
        .update({
          affiliate_id: target.affiliate_id,
          event_id: target.event_id,
          basis_amount: target.basis,
          rate: target.rate,
          amount: target.amount,
          status: "accrued",
        })
        .eq("id", existing.id);
    }
  } else if (existing && existing.status === "accrued") {
    // No commission is owed anymore (not fully paid, or the event lost its
    // affiliate) — reverse the outstanding accrual.
    await supabase
      .from("affiliate_commissions")
      .update({ status: "reversed" })
      .eq("id", existing.id);
  }
}

/**
 * Re-sync every affiliate commission on an event after its attribution or rate
 * changed. Re-runs accrual for each of the event's invoices, so outstanding
 * (unpaid) commissions immediately reflect the event's current affiliate + rate,
 * and any accrual that is no longer owed (attribution cleared) is reversed.
 * Already-paid commissions are never touched. Give it a PRIVILEGED client — it
 * reads events/invoices/affiliates and writes affiliate_commissions as a system
 * side effect of an attribution edit, not a user write.
 */
export async function resyncEventAffiliateCommissions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("event_id", eventId);

  for (const inv of (invoices ?? []) as { id: string; status: string }[]) {
    await accrueAffiliateCommission(supabase, inv.id, inv.status);
  }
}

/**
 * Move a draft event to confirmed and email the client. No-op (returns false)
 * if the event isn't draft, isn't found, or the update is blocked (e.g. RLS).
 */
async function activateEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data: eventRow } = await supabase
    .from("events")
    .select("id, status, title, event_date, contact_id")
    .eq("id", eventId)
    .maybeSingle();
  const event = eventRow as {
    id: string;
    status: string;
    title: string | null;
    event_date: string | null;
    contact_id: string | null;
  } | null;
  if (!event || event.status !== "draft") return false;

  const { error } = await supabase
    .from("events")
    .update({ status: "confirmed" })
    .eq("id", event.id);
  if (error) {
    console.error("[lifecycle] event activation blocked:", error.message);
    return false;
  }

  // Email the client their booking is confirmed (guarded no-op without a key).
  if (event.contact_id) {
    try {
      const { data: contactRow } = await supabase
        .from("contacts")
        .select("email, first_name")
        .eq("id", event.contact_id)
        .maybeSingle();
      const contact = contactRow as {
        email: string | null;
        first_name: string | null;
      } | null;
      await notifyBookingConfirmed(contact?.email, {
        eventTitle: event.title ?? "your event",
        eventDate: event.event_date ?? null,
        recipientName: contact?.first_name ?? null,
      });
    } catch (e) {
      console.error("[email] booking-confirmed (payment) failed:", e);
    }
  }

  revalidatePath(`/events/${event.id}`);
  revalidatePath("/events");
  return true;
}
