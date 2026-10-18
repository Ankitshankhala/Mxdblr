-- Dealer OTP: count wrong guesses per code (locks at 5) and record when a code
-- was actually entered correctly (registration requires that, not just "used").
ALTER TABLE "OtpCode" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
