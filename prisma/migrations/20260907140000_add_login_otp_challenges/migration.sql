-- Pending email OTP challenges for dealer/salesman login (Phase 2 poin 4).
CREATE TABLE "login_otp_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_otp_challenges_userId_createdAt_idx" ON "login_otp_challenges"("userId", "createdAt");
CREATE INDEX "login_otp_challenges_expiresAt_idx" ON "login_otp_challenges"("expiresAt");

ALTER TABLE "login_otp_challenges"
  ADD CONSTRAINT "login_otp_challenges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
