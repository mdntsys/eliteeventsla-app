import "server-only";

import { getResend, FROM_EMAIL } from "@/lib/resend";
import {
  bookingConfirmedEmail,
  vendorConfirmationRequestEmail,
  crewAssignmentEmail,
  returnReceiptEmail,
  type RenderedEmail,
} from "@/lib/email/templates";

/**
 * Server-only email sending. Every path is GUARDED + NON-THROWING: when
 * RESEND_API_KEY is absent (it currently is), sendEmail no-ops and logs, so the
 * triggers wired into actions never break a user flow. The typed notify*
 * helpers resolve a recipient and fire the right template — call them
 * fire-and-forget from server actions; they swallow their own errors.
 */

export type SendResult = { ok: boolean; skipped: boolean; error?: string };

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const to = Array.isArray(params.to) ? params.to : [params.to];
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

export async function notifyReturnReceipt(
  to: string | null | undefined,
  p: { eventTitle: string; recipientName?: string | null },
): Promise<void> {
  await fire(to, returnReceiptEmail(p));
}
