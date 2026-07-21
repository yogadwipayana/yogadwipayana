-- Resend support: keep the code a number already delivered.
--
-- Without this, /sms/resend had to blank `code` to signal "waiting again",
-- which destroyed the only record of the first OTP. It was also ambiguous:
-- SMSPool's /request/active keeps reporting the OLD code until a new SMS
-- lands, so a blanked row flipped straight back to completed with the same
-- code and the resend looked instantly successful.
--
-- Storing the superseded code fixes both: the UI can still show it, and the
-- refresh loop can require the reported code to DIFFER before calling the
-- resend delivered.

alter table public.sms_order
  add column if not exists previous_code text;
