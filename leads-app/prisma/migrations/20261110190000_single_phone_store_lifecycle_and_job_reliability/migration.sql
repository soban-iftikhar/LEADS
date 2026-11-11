-- Redesign for reliability (see docs/ARCHITECTURE.md, DR-28 to DR-33):
--   * the encrypted phone lives only in app.contacts; listings keep phone_hash + contact_id
--   * listing lifecycle columns (status, exited_at, last_checked_at)
--   * master.listings can link to config regions/localities
--   * crawl_runs.lock_key: database-level guard against double scheduled runs
--   * job_requests: retries, delayed runs, locks, idempotency key; ops.heartbeats

-- ---------------------------------------------------------------------------
-- 1. Before phone_enc is dropped from the listings tables, make sure every
--    number already has its contact row (the single home of the ciphertext).
-- ---------------------------------------------------------------------------
INSERT INTO "app"."contacts" (phone_hash, phone_enc, name, first_source, purge_at)
SELECT DISTINCT ON (phone_hash) phone_hash, phone_enc, seller_name,
       'PORTAL_SELLER'::"app"."ContactSource", last_seen_at + interval '60 days'
FROM (
  SELECT phone_hash, phone_enc, seller_name, last_seen_at FROM "zameen"."listings"
  UNION ALL SELECT phone_hash, phone_enc, seller_name, last_seen_at FROM "olx"."listings"
  UNION ALL SELECT phone_hash, phone_enc, seller_name, last_seen_at FROM "graana"."listings"
  UNION ALL SELECT phone_hash, phone_enc, seller_name, last_seen_at FROM "ilaan"."listings"
  UNION ALL SELECT phone_hash, phone_enc, seller_name, last_seen_at FROM "master"."listings"
) src
WHERE phone_hash IS NOT NULL AND phone_enc IS NOT NULL
ORDER BY phone_hash, last_seen_at DESC
ON CONFLICT (phone_hash) DO UPDATE
  SET phone_enc = COALESCE("app"."contacts".phone_enc, EXCLUDED.phone_enc);

-- ---------------------------------------------------------------------------
-- 2. Schema changes
-- ---------------------------------------------------------------------------
-- DropIndex
DROP INDEX "ops"."job_requests_status_created_at_idx";

-- AlterTable
ALTER TABLE "app"."contacts" ADD COLUMN     "enc_key_version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "graana"."listings" DROP COLUMN "phone_enc",
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "exited_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "ilaan"."listings" DROP COLUMN "phone_enc",
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "exited_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "master"."crawl_run_portals" ADD COLUMN     "error" TEXT;

-- AlterTable
ALTER TABLE "master"."crawl_runs" ADD COLUMN     "lock_key" TEXT,
ADD COLUMN     "stats" JSONB;

-- AlterTable
ALTER TABLE "master"."listings" DROP COLUMN "phone_enc",
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "exited_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "locality_id" UUID,
ADD COLUMN     "region_id" UUID,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "olx"."listings" DROP COLUMN "phone_enc",
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "exited_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "ops"."job_requests" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "locked_at" TIMESTAMPTZ(6),
ADD COLUMN     "locked_by" TEXT,
ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "run_after" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "zameen"."listings" DROP COLUMN "phone_enc",
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "exited_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_checked_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "ops"."heartbeats" (
    "service" TEXT NOT NULL,
    "beat_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "heartbeats_pkey" PRIMARY KEY ("service")
);

-- CreateIndex
CREATE INDEX "listings_contact_id_idx" ON "graana"."listings"("contact_id");

-- CreateIndex
CREATE INDEX "listings_status_last_checked_at_idx" ON "graana"."listings"("status", "last_checked_at");

-- CreateIndex
CREATE INDEX "listings_contact_id_idx" ON "ilaan"."listings"("contact_id");

-- CreateIndex
CREATE INDEX "listings_status_last_checked_at_idx" ON "ilaan"."listings"("status", "last_checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "crawl_runs_lock_key_key" ON "master"."crawl_runs"("lock_key");

-- CreateIndex
CREATE INDEX "listings_contact_id_idx" ON "master"."listings"("contact_id");

-- CreateIndex
CREATE INDEX "listings_locality_id_category_purpose_idx" ON "master"."listings"("locality_id", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_status_last_checked_at_idx" ON "master"."listings"("status", "last_checked_at");

-- CreateIndex
CREATE INDEX "listings_contact_id_idx" ON "olx"."listings"("contact_id");

-- CreateIndex
CREATE INDEX "listings_status_last_checked_at_idx" ON "olx"."listings"("status", "last_checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_requests_dedupe_key_key" ON "ops"."job_requests"("dedupe_key");

-- CreateIndex
CREATE INDEX "job_requests_status_run_after_idx" ON "ops"."job_requests"("status", "run_after");

-- CreateIndex
CREATE INDEX "listings_contact_id_idx" ON "zameen"."listings"("contact_id");

-- CreateIndex
CREATE INDEX "listings_status_last_checked_at_idx" ON "zameen"."listings"("status", "last_checked_at");

-- AddForeignKey
ALTER TABLE "zameen"."listings" ADD CONSTRAINT "listings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olx"."listings" ADD CONSTRAINT "listings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graana"."listings" ADD CONSTRAINT "listings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ilaan"."listings" ADD CONSTRAINT "listings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master"."listings" ADD CONSTRAINT "listings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master"."listings" ADD CONSTRAINT "listings_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "config"."regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master"."listings" ADD CONSTRAINT "listings_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "config"."localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- 3. Link existing listings to their contact
-- ---------------------------------------------------------------------------
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['zameen', 'olx', 'graana', 'ilaan', 'master'] LOOP
    EXECUTE format(
      'UPDATE %I.listings l SET contact_id = c.id FROM app.contacts c
        WHERE l.phone_hash = c.phone_hash AND l.contact_id IS NULL', s);
    EXECUTE format(
      'ALTER TABLE %I.listings ADD CONSTRAINT listings_status_check CHECK (status IN (''active'', ''exited''))', s);
    EXECUTE format(
      'ALTER TABLE %I.listings ADD CONSTRAINT listings_exited_at_check
         CHECK ((status = ''exited'') = (exited_at IS NOT NULL))', s);
  END LOOP;
END $$;

ALTER TABLE "ops"."job_requests" ADD CONSTRAINT "job_requests_attempts_check"
  CHECK (attempts >= 0 AND max_attempts >= 1);
