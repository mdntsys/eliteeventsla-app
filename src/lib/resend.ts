import { Resend } from "resend";

/**
 * SERVER-ONLY transactional email client (Resend). Lazily constructed so a
 * missing key never breaks the build. RESEND_API_KEY stays server-side.
 */
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  _resend = new Resend(key);
  return _resend;
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Elite Events LA <onboarding@resend.dev>";
