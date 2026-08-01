-- Drop the dead Session model. It was never queried anywhere in the codebase
-- (dealer auth uses stateless JWTs with lastRevokedAt-based revocation).
-- Removing it eliminates an unused table and its FK to Dealer.
DROP TABLE IF EXISTS "Session";
