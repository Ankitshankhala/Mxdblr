-- Audit action for admin-issued dealer login codes.
--
-- Until WhatsApp OTP delivery is approved by Meta, an admin can mint a one-time
-- login code and relay it to the dealer by hand. That mints an authentication
-- credential, so every issuance must land in the audit trail.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that adds it,
-- but the value is only referenced at runtime, so this is safe as a standalone
-- migration step.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DEALER_LOGIN_CODE_ISSUED';
