/**
 * Transactional email templates (pure render functions — no I/O). Each returns
 * { subject, html, text }. HTML uses inline styles in the brand palette so it
 * renders in email clients. Kept deliberately simple and on-brand.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

const NAVY = "#16263a";
const CREAM = "#f4f1ea";
const CARD = "#faf8f3";
const INK = "#22211d";
const MUTED = "#6f6a60";
const LINE = "#ddd7ca";

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Branded HTML shell around a body. */
function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:${CREAM};padding:24px;font-family:Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding:8px 4px 16px;">
      <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:${NAVY};letter-spacing:0.5px;">Elite Events LA</span>
    </td></tr>
    <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;color:${NAVY};">${heading}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:16px 4px;color:${MUTED};font-size:12px;">
      Elite Events LA · This is an automated message from our operations system.
    </td></tr>
  </table>
</body></html>`;
}

const P = `style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${INK};"`;
const META = `style="margin:0 0 6px;font-size:14px;color:${MUTED};"`;

export function bookingConfirmedEmail(p: {
  eventTitle: string;
  eventDate?: string | null;
  recipientName?: string | null;
}): RenderedEmail {
  const date = formatDate(p.eventDate);
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const html = layout("Your event is confirmed", `
    <p ${P}>${hi}</p>
    <p ${P}>Great news — <strong>${p.eventTitle}</strong> is confirmed. Our team is preparing everything for your event${date ? ` on <strong>${date}</strong>` : ""}.</p>
    <p ${P}>We'll be in touch with delivery and setup details as your date approaches. Reply to this email anytime with questions.</p>
    <p ${P}>Thank you for choosing Elite Events LA.</p>`);
  const text = `${hi}\n\nGreat news — ${p.eventTitle} is confirmed${date ? ` on ${date}` : ""}. Our team is preparing everything. We'll follow up with delivery and setup details.\n\nThank you for choosing Elite Events LA.`;
  return { subject: `Confirmed: ${p.eventTitle}`, html, text };
}

export function vendorConfirmationRequestEmail(p: {
  vendorName: string;
  eventTitle: string;
  service?: string | null;
  eventDate?: string | null;
}): RenderedEmail {
  const date = formatDate(p.eventDate);
  const html = layout("Can you confirm this booking?", `
    <p ${P}>Hi ${p.vendorName},</p>
    <p ${P}>We'd like to book you for <strong>${p.eventTitle}</strong>${p.service ? ` (${p.service})` : ""}${date ? ` on <strong>${date}</strong>` : ""}.</p>
    <p ${P}>Please reply to confirm your availability and we'll send over the details. Thanks for partnering with us!</p>`);
  const text = `Hi ${p.vendorName},\n\nWe'd like to book you for ${p.eventTitle}${p.service ? ` (${p.service})` : ""}${date ? ` on ${date}` : ""}. Please reply to confirm your availability.\n\nThanks for partnering with Elite Events LA.`;
  return {
    subject: `Booking request: ${p.eventTitle}`,
    html,
    text,
  };
}

export function crewAssignmentEmail(p: {
  staffName?: string | null;
  eventTitle: string;
  role?: string | null;
  whenText?: string | null;
}): RenderedEmail {
  const when = formatDate(p.whenText);
  const hi = p.staffName ? `Hi ${p.staffName},` : "Hi,";
  const html = layout("You're on a job", `
    <p ${P}>${hi}</p>
    <p ${P}>You've been assigned to <strong>${p.eventTitle}</strong>.</p>
    ${p.role ? `<p ${META}>Role: ${p.role}</p>` : ""}
    ${when ? `<p ${META}>When: ${when}</p>` : ""}
    <p ${P}>Check the operations dashboard for the full schedule and details.</p>`);
  const text = `${hi}\n\nYou've been assigned to ${p.eventTitle}.${p.role ? `\nRole: ${p.role}` : ""}${when ? `\nWhen: ${when}` : ""}\n\nCheck the operations dashboard for details.`;
  return { subject: `Crew assignment: ${p.eventTitle}`, html, text };
}

export function returnReceiptEmail(p: {
  eventTitle: string;
  recipientName?: string | null;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const html = layout("All items returned", `
    <p ${P}>${hi}</p>
    <p ${P}>This confirms that all rental items for <strong>${p.eventTitle}</strong> have been returned and checked in. Your job is now complete.</p>
    <p ${P}>It was a pleasure working with you — we'd love to help with your next event.</p>`);
  const text = `${hi}\n\nThis confirms that all rental items for ${p.eventTitle} have been returned and checked in. Your job is complete.\n\nWe'd love to help with your next event — Elite Events LA.`;
  return { subject: `Return receipt: ${p.eventTitle}`, html, text };
}

export function paymentLinkEmail(p: {
  url: string;
  invoiceNumber?: string | null;
  amountText?: string | null;
  recipientName?: string | null;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const ref = p.invoiceNumber ? ` (<strong>${p.invoiceNumber}</strong>)` : "";
  const refText = p.invoiceNumber ? ` (${p.invoiceNumber})` : "";
  const forAmount = p.amountText ? ` for <strong>${p.amountText}</strong>` : "";
  const forAmountText = p.amountText ? ` for ${p.amountText}` : "";
  const button = `<a href="${p.url}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">Pay${p.amountText ? ` ${p.amountText}` : ""} securely →</a>`;
  const html = layout("Your invoice from Elite Events LA", `
    <p ${P}>${hi}</p>
    <p ${P}>Here's your invoice${ref}${forAmount}. You can pay securely online — by card — using the button below.</p>
    <p style="margin:20px 0;">${button}</p>
    <p ${META}>Or paste this link into your browser:<br><a href="${p.url}" style="color:${NAVY};word-break:break-all;">${p.url}</a></p>
    <p ${P}>Thank you for choosing Elite Events LA.</p>`);
  const text = `${hi}\n\nHere's your invoice${refText}${forAmountText}. Pay securely online:\n${p.url}\n\nThank you for choosing Elite Events LA.`;
  return {
    subject: `Your invoice from Elite Events LA${p.invoiceNumber ? ` — ${p.invoiceNumber}` : ""}`,
    html,
    text,
  };
}

export function invoiceEmail(p: {
  url: string;
  invoiceNumber?: string | null;
  amountText?: string | null;
  dueDateText?: string | null;
  recipientName?: string | null;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const ref = p.invoiceNumber ? ` <strong>${p.invoiceNumber}</strong>` : "";
  const refText = p.invoiceNumber ? ` ${p.invoiceNumber}` : "";
  const forAmount = p.amountText ? ` for <strong>${p.amountText}</strong>` : "";
  const forAmountText = p.amountText ? ` for ${p.amountText}` : "";
  const due =
    p.dueDateText && p.dueDateText !== "—"
      ? ` It's due <strong>${p.dueDateText}</strong>.`
      : "";
  const dueText =
    p.dueDateText && p.dueDateText !== "—" ? ` Due ${p.dueDateText}.` : "";
  const button = `<a href="${p.url}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">View &amp; pay your invoice →</a>`;
  const html = layout("Your invoice from Elite Events LA", `
    <p ${P}>${hi}</p>
    <p ${P}>Your itemized invoice${ref}${forAmount} is ready.${due} Open it to review the line items and pay securely by card — or pay by Zelle, wire, or check using the details on the invoice. A PDF copy is attached for your records.</p>
    <p style="margin:20px 0;">${button}</p>
    <p ${META}>Or paste this link into your browser:<br><a href="${p.url}" style="color:${NAVY};word-break:break-all;">${p.url}</a></p>
    <p ${P}>Thank you for choosing Elite Events LA.</p>`);
  const text = `${hi}\n\nYour itemized invoice${refText}${forAmountText} is ready.${dueText}\n\nView & pay: ${p.url}\n\nYou can pay by card online, or by Zelle, wire, or check (details on the invoice). A PDF copy is attached.\n\nThank you for choosing Elite Events LA.`;
  return {
    subject: `Your invoice from Elite Events LA${p.invoiceNumber ? ` — ${p.invoiceNumber}` : ""}`,
    html,
    text,
  };
}

export function invoiceVoidedEmail(p: {
  invoiceNumber?: string | null;
  amountText?: string | null;
  recipientName?: string | null;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const ref = p.invoiceNumber ? ` <strong>${p.invoiceNumber}</strong>` : "";
  const refText = p.invoiceNumber ? ` ${p.invoiceNumber}` : "";
  const forAmount = p.amountText ? ` for <strong>${p.amountText}</strong>` : "";
  const forAmountText = p.amountText ? ` for ${p.amountText}` : "";
  const html = layout("Your invoice has been voided", `
    <p ${P}>${hi}</p>
    <p ${P}>We're letting you know that your invoice${ref}${forAmount} has been <strong>voided</strong> and is no longer due. No payment is required, and any payment link we may have sent for it is now inactive.</p>
    <p ${P}>If you think this was done in error, or you have any questions, just reply to this email and we'll be glad to help.</p>
    <p ${P}>Thank you for choosing Elite Events LA.</p>`);
  const text = `${hi}\n\nYour invoice${refText}${forAmountText} has been voided and is no longer due. No payment is required, and any payment link we may have sent for it is now inactive.\n\nIf this was done in error or you have questions, just reply to this email.\n\nThank you for choosing Elite Events LA.`;
  return {
    subject: `Invoice voided${p.invoiceNumber ? ` — ${p.invoiceNumber}` : ""} · Elite Events LA`,
    html,
    text,
  };
}

export function signatureRequestEmail(p: {
  recipientName?: string | null;
  documentTitle: string;
  signUrl: string;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const button = `<a href="${p.signUrl}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">Review &amp; sign →</a>`;
  const html = layout("A document is ready for your signature", `
    <p ${P}>${hi}</p>
    <p ${P}><strong>${p.documentTitle}</strong> is ready for your electronic signature. It only takes a moment — open it, review, and click to sign.</p>
    <p style="margin:20px 0;">${button}</p>
    <p ${META}>Or paste this link into your browser:<br><a href="${p.signUrl}" style="color:${NAVY};word-break:break-all;">${p.signUrl}</a></p>
    <p ${P}>Thank you.</p>`);
  const text = `${hi}\n\n${p.documentTitle} is ready for your electronic signature. Review & sign:\n${p.signUrl}\n\nThank you.`;
  return { subject: `Please sign: ${p.documentTitle}`, html, text };
}

/** To the client after they sign their SOW — a copy is attached for their records. */
export function sowSignedClientEmail(p: {
  recipientName?: string | null;
  documentTitle: string;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const html = layout("Your signed Statement of Work", `
    <p ${P}>${hi}</p>
    <p ${P}>Thank you — your signature on <strong>${p.documentTitle}</strong> has been recorded. A copy of the fully executed agreement is attached to this email for your records.</p>
    <p ${P}>If you have any questions, just reply to this email and we'll be glad to help.</p>
    <p ${P}>Thank you for choosing Elite Events LA.</p>`);
  const text = `${hi}\n\nThank you — your signature on ${p.documentTitle} has been recorded. A copy of the fully executed agreement is attached to this email for your records.\n\nIf you have any questions, just reply to this email.\n\nThank you for choosing Elite Events LA.`;
  return { subject: `Signed: ${p.documentTitle}`, html, text };
}

/** To the internal sales team when a customer signs a SOW. */
export function sowSignedInternalEmail(p: {
  documentTitle: string;
  documentUrl: string;
  signerName: string;
  signerEmail?: string | null;
  eventTitle?: string | null;
  mediaRelease?: boolean | null;
  signedAt?: string | null;
}): RenderedEmail {
  const when = formatDate(p.signedAt);
  const media =
    p.mediaRelease == null
      ? "not specified"
      : p.mediaRelease
        ? "YES — may use & share event media"
        : "NO — keep media private";
  const button = `<a href="${p.documentUrl}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px;">Open the document →</a>`;
  const html = layout("A Statement of Work was signed", `
    <p ${P}>Heads up — a customer just signed their Statement of Work.</p>
    <p ${META}>Document: <strong>${p.documentTitle}</strong></p>
    ${p.eventTitle ? `<p ${META}>Event: <strong>${p.eventTitle}</strong></p>` : ""}
    <p ${META}>Signed by: <strong>${p.signerName}</strong>${p.signerEmail ? ` (${p.signerEmail})` : ""}</p>
    ${when ? `<p ${META}>Signed: <strong>${when}</strong></p>` : ""}
    <p ${META}>Media release: <strong>${media}</strong></p>
    <p style="margin:18px 0;">${button}</p>`);
  const text = `A customer just signed their Statement of Work.\n\nDocument: ${p.documentTitle}\n${p.eventTitle ? `Event: ${p.eventTitle}\n` : ""}Signed by: ${p.signerName}${p.signerEmail ? ` (${p.signerEmail})` : ""}\n${when ? `Signed: ${when}\n` : ""}Media release: ${media}\n\nOpen the document: ${p.documentUrl}`;
  return { subject: `SOW signed: ${p.documentTitle}`, html, text };
}

export function affiliateWelcomeEmail(p: {
  fullName?: string | null;
  email: string;
  tempPassword: string;
  signInUrl: string;
  commissionPct: number;
}): RenderedEmail {
  const hi = p.fullName ? `Hi ${p.fullName},` : "Hello,";
  const button = `<a href="${p.signInUrl}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">Sign in to your partner portal</a>`;
  const html = layout("Welcome to the Elite Events LA partner program", `
    <p ${P}>${hi}</p>
    <p ${P}>You've been set up as a referral partner with Elite Events LA. Your commission rate is <strong>${p.commissionPct}%</strong> of the revenue we collect on sales you refer.</p>
    <p ${P}>Sign in to your partner portal to review your commissions, event history, and payouts:</p>
    <p ${META}>Email: <strong>${p.email}</strong></p>
    <p ${META}>Temporary password: <strong>${p.tempPassword}</strong></p>
    <p style="margin:18px 0;">${button}</p>
    <p ${P}>On your first sign-in you'll be asked to review and sign your commission agreement before the portal unlocks. For your security, please change your password right after signing in.</p>`);
  const text = `${hi}\n\nYou've been set up as a referral partner with Elite Events LA. Your commission rate is ${p.commissionPct}% of the revenue we collect on sales you refer.\n\nSign in to your partner portal: ${p.signInUrl}\nEmail: ${p.email}\nTemporary password: ${p.tempPassword}\n\nOn your first sign-in you'll review and sign your commission agreement before the portal unlocks. Please change your password after signing in.`;
  return { subject: "Your Elite Events LA partner account", html, text };
}

export function commissionEarnedEmail(p: {
  recipientName?: string | null;
  amountText: string;
  eventTitle?: string | null;
  portalUrl: string;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const forEvent = p.eventTitle
    ? ` from <strong>${p.eventTitle}</strong>`
    : "";
  const forEventText = p.eventTitle ? ` from ${p.eventTitle}` : "";
  const button = `<a href="${p.portalUrl}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">View your portal</a>`;
  const html = layout("You earned a commission", `
    <p ${P}>${hi}</p>
    <p ${P}>Good news — a referral you sent to Elite Events LA has been paid in full, so you've earned a commission of <strong>${p.amountText}</strong>${forEvent}.</p>
    <p ${P}>It's been added to your owed balance and will be included in your next payout.</p>
    <p style="margin:18px 0;">${button}</p>`);
  const text = `${hi}\n\nA referral you sent to Elite Events LA has been paid in full, so you've earned a commission of ${p.amountText}${forEventText}. It's been added to your owed balance and will be included in your next payout.\n\nView your portal: ${p.portalUrl}`;
  return { subject: "You earned a commission", html, text };
}

export function payoutRecordedEmail(p: {
  recipientName?: string | null;
  amountText: string;
  methodText?: string | null;
  portalUrl: string;
}): RenderedEmail {
  const hi = p.recipientName ? `Hi ${p.recipientName},` : "Hello,";
  const via = p.methodText ? ` via ${p.methodText}` : "";
  const button = `<a href="${p.portalUrl}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">View your payouts</a>`;
  const html = layout("A commission payout was recorded", `
    <p ${P}>${hi}</p>
    <p ${P}>We've recorded a commission payout of <strong>${p.amountText}</strong>${via}. It covers commissions that were awaiting payout on your account.</p>
    <p ${P}>You can review it any time in your partner portal under Payouts.</p>
    <p style="margin:18px 0;">${button}</p>`);
  const text = `${hi}\n\nWe've recorded a commission payout of ${p.amountText}${via}. It covers commissions that were awaiting payout on your account.\n\nView your payouts: ${p.portalUrl}`;
  return { subject: "Your Elite Events LA commission payout", html, text };
}

export function welcomeEmail(p: {
  fullName?: string | null;
  email: string;
  tempPassword: string;
  signInUrl: string;
}): RenderedEmail {
  const hi = p.fullName ? `Hi ${p.fullName},` : "Hello,";
  const button = `<a href="${p.signInUrl}" style="display:inline-block;background:${NAVY};color:${CREAM};text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">Sign in</a>`;
  const html = layout("You've been added to Elite Events LA", `
    <p ${P}>${hi}</p>
    <p ${P}>An account was created for you on the Elite Events LA Operations system. Sign in with these credentials:</p>
    <p ${META}>Email: <strong>${p.email}</strong></p>
    <p ${META}>Temporary password: <strong>${p.tempPassword}</strong></p>
    <p style="margin:18px 0;">${button}</p>
    <p ${P}>For your security, please change your password right after signing in — open <strong>Account</strong> in the sidebar, then <strong>Change password</strong>.</p>`);
  const text = `${hi}\n\nAn account was created for you on Elite Events LA Operations.\n\nSign in: ${p.signInUrl}\nEmail: ${p.email}\nTemporary password: ${p.tempPassword}\n\nPlease change your password after signing in (Account → Change password).`;
  return { subject: "Your Elite Events LA account", html, text };
}
