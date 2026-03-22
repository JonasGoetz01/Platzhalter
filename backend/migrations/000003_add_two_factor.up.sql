ALTER TABLE "user" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "twoFactor" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    secret TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_two_factor_secret ON "twoFactor"(secret);
CREATE INDEX idx_two_factor_user_id ON "twoFactor"("userId");
