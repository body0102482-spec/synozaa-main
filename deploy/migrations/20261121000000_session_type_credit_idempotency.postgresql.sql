BEGIN;

CREATE TYPE "SessionType" AS ENUM ('CHAT', 'LIVE_VOICE');

ALTER TABLE "Session"
  ADD COLUMN "sessionType" "SessionType" NOT NULL DEFAULT 'CHAT',
  ADD COLUMN "creditCost" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotencyKey" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Session"
    WHERE "idempotencyKey" IS NOT NULL
    GROUP BY "userId", "idempotencyKey"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Session(userId, idempotencyKey) values prevent creating the unique index';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "Session_userId_idempotencyKey_key"
  ON "Session" ("userId", "idempotencyKey");

COMMIT;
