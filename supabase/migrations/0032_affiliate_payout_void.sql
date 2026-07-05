-- 0032 — Payout robustness (Phase 8): voidable payouts.
--
-- recordPayout previously paid ALL of an affiliate's accrued commissions at once
-- with no undo. P8 adds selective payouts (handled at the app layer — it passes
-- the chosen commission ids) and the ability to VOID a payout: its commissions
-- return to 'accrued' (owed again) while the payout row is KEPT for audit with
-- voided_at set, and excluded from paid totals.
alter table public.affiliate_payouts
  add column voided_at timestamptz;
