-- Customer app tables (listings documents and timeline, lead activity, follow-up kind, owner city),
-- refresh-token rotation on sessions (DR-45), and the legacy cut-over (DR-41): legacy users are
-- copied into app.users first, then the pre-v4 public tables are dropped.

-- ---------------------------------------------------------------- legacy users -> app.users (DR-41)
-- bcrypt hashes carry over, so passwords keep working. Phones are not copied: legacy rows hold
-- plaintext numbers, and the WhatsApp number is verified again inside the app (DR-42).
INSERT INTO "app"."users" ("email", "full_name", "password_hash", "role", "status", "email_verified_at", "created_at", "updated_at")
SELECT lower(u."email"), u."fullName", u."passwordHash",
       (CASE u."role"::text WHEN 'ADMIN' THEN 'ADMIN' WHEN 'BUYER' THEN 'BUYER' ELSE 'CUSTOMER_SELLER' END)::"app"."Role",
       (CASE WHEN u."isActive" THEN 'ACTIVE' ELSE 'SUSPENDED' END)::"app"."UserStatus",
       CASE WHEN u."isEmailVerified" THEN u."updatedAt" END,
       u."createdAt", u."updatedAt"
FROM "public"."users" u
WHERE NOT EXISTS (SELECT 1 FROM "app"."users" a WHERE a."email" = lower(u."email"));

INSERT INTO "app"."customer_profiles" ("user_id", "kind", "display_name", "areas", "property_types")
SELECT a."id", 'SELLER', a."full_name", '{}', '{}'
FROM "app"."users" a JOIN "public"."users" u ON lower(u."email") = a."email"
WHERE a."role" = 'CUSTOMER_SELLER' AND NOT EXISTS (SELECT 1 FROM "app"."customer_profiles" p WHERE p."user_id" = a."id");

INSERT INTO "app"."buyer_profiles" ("user_id", "name", "preferred_areas")
SELECT a."id", a."full_name", '{}'
FROM "app"."users" a JOIN "public"."users" u ON lower(u."email") = a."email"
WHERE a."role" = 'BUYER' AND NOT EXISTS (SELECT 1 FROM "app"."buyer_profiles" p WHERE p."user_id" = a."id");

-- CreateEnum
CREATE TYPE "app"."DocumentKind" AS ENUM ('REGISTRY', 'TRANSFER_LETTER', 'ALLOTMENT_LETTER');

-- CreateEnum
CREATE TYPE "app"."FollowUpKind" AS ENUM ('CALL', 'VISIT');

-- CreateEnum
CREATE TYPE "app"."LeadEventKind" AS ENUM ('STAGE_CHANGED', 'REPORTED', 'REPORT_DECIDED');

-- DropForeignKey
ALTER TABLE "public"."listings" DROP CONSTRAINT "listings_sellerId_fkey";

-- DropIndex
DROP INDEX "app"."users_legacy_id_key";

-- AlterTable
ALTER TABLE "app"."customer_profiles" ADD COLUMN     "region_id" UUID;

-- AlterTable
ALTER TABLE "app"."leads" ADD COLUMN     "follow_up_kind" "app"."FollowUpKind";

-- AlterTable
ALTER TABLE "app"."listings" ADD COLUMN     "owner_name" TEXT,
ALTER COLUMN "purpose" SET DEFAULT 'SALE',
ALTER COLUMN "price_pkr" DROP NOT NULL,
ALTER COLUMN "size_value" DROP NOT NULL,
ALTER COLUMN "size_sqft" DROP NOT NULL,
ALTER COLUMN "locality_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "app"."sessions" ADD COLUMN     "previous_token_hash" TEXT,
ADD COLUMN     "remember" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rotated_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."users" DROP COLUMN "legacy_id";

-- DropTable
DROP TABLE "public"."listings";

-- DropTable
DROP TABLE "public"."users";

-- DropEnum
DROP TYPE "public"."ListingStatus";

-- DropEnum
DROP TYPE "public"."Purpose";

-- DropEnum
DROP TYPE "public"."Role";

-- DropEnum
DROP TYPE "public"."SizeUnit";

-- CreateTable
CREATE TABLE "app"."listing_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "kind" "app"."DocumentKind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "cloudinary_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."listing_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "status" "app"."ListingStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."lead_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "kind" "app"."LeadEventKind" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_documents_listing_id_idx" ON "app"."listing_documents"("listing_id");

-- CreateIndex
CREATE INDEX "listing_status_events_listing_id_created_at_idx" ON "app"."listing_status_events"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_events_lead_id_created_at_idx" ON "app"."lead_events"("lead_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_previous_token_hash_key" ON "app"."sessions"("previous_token_hash");

-- AddForeignKey
ALTER TABLE "app"."customer_profiles" ADD CONSTRAINT "customer_profiles_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "config"."regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "config"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "config"."localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listing_documents" ADD CONSTRAINT "listing_documents_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listing_status_events" ADD CONSTRAINT "listing_status_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."lead_events" ADD CONSTRAINT "lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "app"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------- hand-written checks (Prisma cannot express these)
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_category_check" CHECK ("category" IN ('HOUSE', 'PLOT', 'FLAT', 'COMMERCIAL'));
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_purpose_check" CHECK ("purpose" IN ('SALE', 'RENT'));
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_size_unit_check" CHECK ("size_unit" IN ('MARLA', 'KANAL', 'SQFT', 'SQYD'));
-- drafts (and listings sent back for changes) may be half filled in; one in review, live, paused
-- or sold must have price, size and area
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_complete_when_submitted_check" CHECK (
  "status" NOT IN ('UNDER_REVIEW', 'APPROVED', 'PAUSED', 'SOLD')
  OR ("price_pkr" IS NOT NULL AND "size_value" IS NOT NULL AND "size_sqft" IS NOT NULL AND "locality_id" IS NOT NULL)
);
-- one order per listing may wait for payment, and one may be running, at any time
CREATE UNIQUE INDEX "orders_one_pending_per_listing" ON "app"."orders" ("listing_id") WHERE "status" = 'PENDING_PAYMENT';
-- a refresh token presented again after it was replaced revokes its session (DR-45)
ALTER TABLE "app"."sessions" DROP CONSTRAINT "sessions_revoked_reason_check";
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_revoked_reason_check"
  CHECK (revoked_reason IS NULL OR revoked_reason IN
    ('logout', 'logout_all', 'password_changed', 'password_reset', 'suspended', 'deleted', 'admin', 'rotated', 'refresh_reuse'));
