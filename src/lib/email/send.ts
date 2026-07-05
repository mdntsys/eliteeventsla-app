import "server-only";

import { getResend, FROM_EMAIL } from "@/lib/resend";
import {
  bookingConfirmedEmail,
  vendorConfirmationRequestEmail,
  crewAssignmentEmail,
  returnReceiptEmail,
  paymentLinkEmail,
  invoiceEmail,
  invoiceVoidedEmail,
  commissionEarnedEmail,
  payoutRecordedEmail,
  type RenderedEmail,
} from "@/lib/email/templates";

/**
 * Server-only email sending. Every path is GUARDED + NON-THROWING: if
 * RESEND_API_KEY is absent (e.g. a local shell without env loaded), sendEmail
 * no-ops and logs instead of throwing, so the triggers wired into actions never
 * break a user flow. When the key IS set (the configured/deployed case), email
 * sends for real. The typed notify* helpers resolve a recipient and fire the
 * right template — call them fire-and-forget from server actions; they swallow
 * their own errors.
 */

export type SendResult = { ok: boolean; skipped: boolean; error?: string };

export type EmailAttachment = { filename: string; content: Buffer | string };

/**
 * Team BCC for client invoice emails, so the group has a copy in their inbox as
 * proof an invoice went out. Defaults to sales@eliteeventsla.com; override with
 * INVOICE_BCC (comma-separated), or set INVOICE_BCC="" to disable.
 */
export function getInvoiceBcc(): string[] {
  const raw = process.env.INVOICE_BCC;
  const value = raw === undefined ? "sales@eliteeventsla.com" : raw;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  bcc?: string | string[];
}): Promise<SendResult> {
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const bcc = (
    params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : []
  ).filter(Boolean);
  if (!process.env.RESEND_API_KEY) {
    console.info(
      `[email] skipped (no RESEND_API_KEY): "${params.subject}" -> ${to.join(", ")}`,
    );
    return { ok: false, skipped: true };
  }
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.attachments?.length
        ? { attachments: params.attachments }
        : {}),
      ...(bcc.length ? { bcc } : {}),
    });
    if (error) {
      const message =
        (error as { message?: string }).message ?? "Resend returned an error.";
      console.error("[email] send error:", message);
      return { ok: false, skipped: false, error: message };
    }
    return { ok: true, skipped: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email send failed.";
    console.error("[email] send threw:", message);
    return { ok: false, skipped: false, error: message };
  }
}

async function fire(to: string | null | undefined, rendered: RenderedEmail): Promise<void> {
  if (!to) return;
  await sendEmail({ to, ...rendered });
}

export async function notifyBookingConfirmed(
  to: string | null | undefined,
  p: { eventTitle: string; eventDate?: string | null; recipientName?: string | null },
): Promise<void> {
  await fire(to, bookingConfirmedEmail(p));
}

export async function notifyVendorConfirmationRequest(
  to: string | null | undefined,
  p: {
    vendorName: string;
    eventTitle: string;
    service?: string | null;
    eventDate?: string | null;
  },
): Promise<void> {
  await fire(to, vendorConfirmationRequestEmail(p));
}

export async function notifyCrewAssignment(
  to: string | null | undefined,
  p: {
    staffName?: string | null;
    eventTitle: string;
    role?: string | null;
    whenText?: string | null;
  },
): Promise<void> {
  await fire(to, crewAssignmentEmail(p));
}

/**
 * Email a client a Stripe payment link for their invoice. Unlike the other
 * notify* helpers (fire-and-forget), this RETURNS the SendResult so the action
 * can tell the operator whether it actually went out (or was skipped because
 * email isn't configured).
 */
export async function notifyPaymentLink(
  to: string | null | undefined,
  p: {
    url: string;
    invoiceNumber?: string | null;
    amountText?: string | null;
    recipientName?: string | null;
  },
): Promise<SendResult> {
  if (!to) return { ok: false, skipped: true, error: "No recipient email." };
  return sendEmail({ to, ...paymentLinkEmail(p) });
}

/**
 * Email a client their itemized invoice — a link to the public invoice page
 * plus the PDF as an attachment. Returns the SendResult so the action can tell
 * the operator whether it went out (or was skipped because email isn't set up).
 */
export async function notifyInvoice(
  to: string | null | undefined,
  p: {
    url: string;
    invoiceNumber?: string | null;
    amountText?: string | null;
    dueDateText?: string | null;
    recipientName?: string | null;
  },
  attachments?: EmailAttachment[],
): Promise<SendResult> {
  if (!to) return { ok: false, skipped: true, error: "No recipient email." };
  // Always BCC the team so they have inbox proof the invoice was sent.
  return sendEmail({ to, bcc: getInvoiceBcc(), ...invoiceEmail(p), attachments });
}

/**
 * Notify a client their invoice has been VOIDED (no longer due). BCCs the team
 * (same INVOICE_BCC list as invoice sends) so the group has inbox proof the
 * notice went out. Returns the SendResult so the action can report whether it
 * actually went out (or was skipped because email isn't configured).
 */
export async function notifyInvoiceVoided(
  to: string | null | undefined,
  p: {
    invoiceNumber?: string | null;
    amountText?: string | null;
    recipientName?: string | null;
  },
): Promise<SendResult> {
  if (!to) return { ok: false, skipped: true, error: "No recipient email." };
  return sendEmail({ to, bcc: getInvoiceBcc(), ...invoiceVoidedEmail(p) });
}

export async function notifyReturnReceipt(
  to: string | null | undefined,
  p: { eventTitle: string; recipientName?: string | null },
): Promise<void> {
  await fire(to, returnReceiptEmail(p));
}

/**
 * The affiliate portal URL for links in partner emails. Works from both a server
 * action and the (headerless) webhook path: prefers APP_URL, else the production
 * host. No request headers needed, so it's safe to call from the reconciler.
 */
function portalUrl(): string {
  const base = (process.env.APP_URL ?? "https://app.eliteeventsla.com").replace(
    /\/$/,
    "",
  );
  return `${base}/portal`;
}

/** Tell an affiliate a commission accrued (their attributed invoice was paid). */
export async function notifyCommissionEarned(
  to: string | null | undefined,
  p: {
    recipientName?: string | null;
    amountText: string;
    eventTitle?: string | null;
  },
): Promise<void> {
  await fire(to, commissionEarnedEmail({ ...p, portalUrl: portalUrl() }));
}

/** Tell an affiliate a payout was recorded against their account. */
export async function notifyPayoutRecorded(
  to: string | null | undefined,
  p: {
    recipientName?: string | null;
    amountText: string;
    methodText?: string | null;
  },
): Promise<void> {
  await fire(to, payoutRecordedEmail({ ...p, portalUrl: portalUrl() }));
}
