-- SPEC_02 section 4: identity, sessions, verification tokens, recovery codes, auth settings.

-- AlterEnum
ALTER TYPE "app"."TokenType" ADD VALUE 'PHONE_CHANGE';

-- DropIndex
DROP INDEX "app"."sessions_user_id_idx";

-- AlterTable
ALTER TABLE "app"."sessions" ADD COLUMN     "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "revoked_reason" TEXT,
ADD COLUMN     "step_up_at" TIMESTAMPTZ(6),
ADD COLUMN     "two_factor_passed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "app"."users" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "full_name" TEXT NOT NULL,
ADD COLUMN     "legacy_id" TEXT,
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(6),
ADD COLUMN     "suspended_at" TIMESTAMPTZ(6),
ADD COLUMN     "suspended_reason" TEXT,
ADD COLUMN     "terms_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "terms_version" TEXT,
ADD COLUMN     "totp_enabled_at" TIMESTAMPTZ(6),
ADD COLUMN     "totp_secret_enc" TEXT;

-- AlterTable
ALTER TABLE "app"."verification_tokens" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "last_sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "app"."recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_user_id_code_hash_key" ON "app"."recovery_codes"("user_id", "code_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "app"."sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_id_key" ON "app"."users"("legacy_id");

-- AddForeignKey
ALTER TABLE "app"."recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- CHECK constraints (Prisma cannot express these)
-- ---------------------------------------------------------------------------

-- 4.1: a deleted user always has deleted_at, and only deleted users have it.
ALTER TABLE "app"."users" ADD CONSTRAINT "users_deleted_check"
  CHECK ((status = 'DELETED') = (deleted_at IS NOT NULL));

-- 4.2: revocation reasons are a fixed list, and a reason always comes with revoked_at.
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_revoked_reason_check"
  CHECK (revoked_reason IS NULL OR revoked_reason IN
    ('logout', 'logout_all', 'password_changed', 'password_reset', 'suspended', 'deleted', 'admin', 'rotated'));
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_revoked_pair_check"
  CHECK (revoked_reason IS NULL OR revoked_at IS NOT NULL);
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_expiry_check"
  CHECK (absolute_expires_at >= created_at AND expires_at <= absolute_expires_at);

-- 4.3: codes go by email or WhatsApp; attempts never negative.
ALTER TABLE "app"."verification_tokens" ADD CONSTRAINT "verification_tokens_channel_check"
  CHECK (channel IN ('EMAIL', 'WHATSAPP'));
ALTER TABLE "app"."verification_tokens" ADD CONSTRAINT "verification_tokens_attempts_check"
  CHECK (attempts >= 0);

-- ---------------------------------------------------------------------------
-- 4.5: users.role and customer_profiles.kind stay consistent.
-- SELLER profile <=> CUSTOMER_SELLER, AGENCY profile <=> CUSTOMER_AGENCY; a user with any
-- other role has no customer profile. Checked at commit (deferred), so a role change and
-- the matching profile change can happen in either order inside one transaction.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "app"."check_customer_kind"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  r   "app"."Role";
  k   "app"."CustomerKind";
BEGIN
  SELECT u.role, p.kind INTO r, k
  FROM "app"."users" u LEFT JOIN "app"."customer_profiles" p ON p.user_id = u.id
  WHERE u.id = uid;
  IF k IS NULL THEN
    RETURN NULL;  -- no customer profile, or the user is gone
  END IF;
  IF (k = 'SELLER' AND r = 'CUSTOMER_SELLER') OR (k = 'AGENCY' AND r = 'CUSTOMER_AGENCY') THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'customer profile kind % does not match user role %', k, r
    USING ERRCODE = 'check_violation', CONSTRAINT = 'customer_kind_matches_role';
END $$;

CREATE CONSTRAINT TRIGGER "customer_profiles_kind_matches_role"
  AFTER INSERT OR UPDATE OF kind, user_id ON "app"."customer_profiles"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "app"."check_customer_kind"('user_id');

CREATE CONSTRAINT TRIGGER "users_role_matches_customer_kind"
  AFTER UPDATE OF role ON "app"."users"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION "app"."check_customer_kind"('id');

-- ---------------------------------------------------------------------------
-- 4.6: settings. Inserted only if missing, so admin changes are never overwritten.
-- ---------------------------------------------------------------------------
INSERT INTO "config"."app_settings" (key, value) VALUES
  ('auth.terms_version', '"2026-11"'),
  ('auth.session', '{"idle_days": 7, "absolute_days": 30, "admin_idle_hours": 12, "admin_absolute_hours": 24}'),
  ('listings.max_active_per_seller', 'null')
ON CONFLICT (key) DO NOTHING;
