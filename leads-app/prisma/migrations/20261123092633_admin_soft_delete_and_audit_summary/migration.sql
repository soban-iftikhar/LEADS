-- Admin console: soft delete on every admin-managed table (archived_at, restorable), team
-- deactivation on users, and a readable summary line on audit rows for the activity log.

-- AlterTable
ALTER TABLE "app"."campaigns" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."contacts" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."lead_reports" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."leads" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."listings" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."orders" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."payments" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "app"."users" ADD COLUMN     "deactivated_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "config"."localities" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "config"."message_templates" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "config"."package_plans" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "config"."portals" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "master"."listings" ADD COLUMN     "archived_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "ops"."audit_log" ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "ops"."audit_log"("created_at");
