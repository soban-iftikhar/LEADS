-- DR-42/DR-43: email-first signup, Google sign-in links, notification preferences.

-- AlterTable
ALTER TABLE "app"."customer_profiles" ADD COLUMN     "notification_prefs" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "app"."verification_tokens" ADD COLUMN     "pending_enc" TEXT;

-- CreateTable
CREATE TABLE "app"."oauth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "app"."oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_user_id_key" ON "app"."oauth_accounts"("provider", "provider_user_id");

-- AddForeignKey
ALTER TABLE "app"."oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
