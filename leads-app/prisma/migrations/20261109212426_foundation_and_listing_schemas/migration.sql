-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "config";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "graana";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ilaan";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "intel";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "master";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "olx";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ops";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "zameen";

-- CreateEnum
CREATE TYPE "config"."TemplatePurpose" AS ENUM ('PROSPECT_SELLER', 'BUYER_CAMPAIGN', 'FOLLOW_UP', 'FORM_LINK', 'LEAD_DELIVERED');

-- CreateEnum
CREATE TYPE "config"."TemplateLanguage" AS ENUM ('EN', 'ROMAN_UR');

-- CreateEnum
CREATE TYPE "app"."Role" AS ENUM ('CUSTOMER_SELLER', 'CUSTOMER_AGENCY', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "app"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "app"."TokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET', 'PHONE_OTP');

-- CreateEnum
CREATE TYPE "app"."CustomerKind" AS ENUM ('SELLER', 'AGENCY');

-- CreateEnum
CREATE TYPE "app"."ListingSource" AS ENUM ('SELF_POSTED', 'AGENCY_POSTED', 'PROSPECT_CONVERTED');

-- CreateEnum
CREATE TYPE "app"."ListingStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'PAUSED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "app"."ReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'NEED_INFO');

-- CreateEnum
CREATE TYPE "app"."OrderStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app"."PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "app"."CashbackStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "app"."ContactSource" AS ENUM ('PORTAL_SELLER', 'BUYER_SIGNUP', 'FORM', 'INQUIRY');

-- CreateEnum
CREATE TYPE "app"."DncReason" AS ENUM ('STOP_REQUEST', 'ANGRY_REPLY', 'ADMIN', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "app"."ProspectStatus" AS ENUM ('SELECTED', 'CONTACTED', 'REPLIED', 'INTERESTED', 'FORM_SENT', 'CONVERTED', 'DECLINED', 'STOPPED', 'NO_REPLY');

-- CreateEnum
CREATE TYPE "app"."CampaignStatus" AS ENUM ('PLANNED', 'RUNNING', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "app"."TargetStatus" AS ENUM ('QUEUED', 'SKIPPED_DNC', 'SKIPPED_CAP', 'SENT', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'STOPPED', 'FORM_SENT', 'FORM_SUBMITTED', 'CONVERTED', 'NO_REPLY');

-- CreateEnum
CREATE TYPE "app"."Direction" AS ENUM ('OUT', 'IN');

-- CreateEnum
CREATE TYPE "app"."Channel" AS ENUM ('WA_API', 'WA_LINK');

-- CreateEnum
CREATE TYPE "app"."MessageStatus" AS ENUM ('PENDING_STAFF', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "app"."Intent" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'QUESTION', 'STOP', 'ANGRY', 'OTHER');

-- CreateEnum
CREATE TYPE "app"."FormKind" AS ENUM ('BUYER_INTEREST', 'PROSPECT_DETAILS');

-- CreateEnum
CREATE TYPE "app"."LeadSource" AS ENUM ('CAMPAIGN_REPLY', 'CAMPAIGN_FORM', 'BUYER_INQUIRY');

-- CreateEnum
CREATE TYPE "app"."LeadStatus" AS ENUM ('DELIVERED', 'REPORTED', 'REPORT_UPHELD', 'REPORT_REJECTED');

-- CreateEnum
CREATE TYPE "app"."CustomerStage" AS ENUM ('NEW', 'CONTACTED', 'VIEWING', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "app"."ReportStatus" AS ENUM ('OPEN', 'UPHELD', 'REJECTED');

-- CreateEnum
CREATE TYPE "ops"."JobType" AS ENUM ('CRAWL_MANUAL', 'CRAWL_PROBE', 'CAMPAIGN_START', 'CAMPAIGN_PAUSE', 'PROSPECT_START', 'CLASSIFY_MESSAGE', 'RECOMPUTE_INTEL', 'SEND_MESSAGE');

-- CreateEnum
CREATE TYPE "ops"."JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "config"."regions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."localities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "aliases" TEXT[],
    "parent_id" UUID,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."portals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requests_per_minute" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "portals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."portal_region_maps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portal_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "external_city_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "portal_region_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."crawl_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portal_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),

    CONSTRAINT "crawl_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."lead_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."package_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "lead_count" INTEGER NOT NULL,
    "price_pkr" BIGINT NOT NULL,
    "delivery_days" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "package_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."message_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "purpose" "config"."TemplatePurpose" NOT NULL,
    "language" "config"."TemplateLanguage" NOT NULL,
    "body" TEXT NOT NULL,
    "wa_template_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config"."app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "app"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "app"."Role" NOT NULL,
    "status" "app"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_hash" TEXT,
    "phone_enc" TEXT,
    "phone_verified_at" TIMESTAMPTZ(6),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."verification_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "app"."TokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."customer_profiles" (
    "user_id" UUID NOT NULL,
    "kind" "app"."CustomerKind" NOT NULL,
    "display_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "areas" TEXT[],
    "property_types" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "app"."buyer_profiles" (
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_id" UUID,
    "preferred_areas" TEXT[],
    "budget_min_pkr" BIGINT,
    "budget_max_pkr" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "app"."listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "source" "app"."ListingSource" NOT NULL,
    "master_listing_id" UUID,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "price_pkr" BIGINT NOT NULL,
    "size_value" DECIMAL(12,2) NOT NULL,
    "size_unit" TEXT NOT NULL,
    "size_sqft" DECIMAL(12,2) NOT NULL,
    "region_id" UUID NOT NULL,
    "locality_id" UUID NOT NULL,
    "address_text" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "amenities" TEXT[],
    "status" "app"."ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "criteria_version" INTEGER,
    "criteria_result" JSONB,
    "rejection_reason" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "sold_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."listing_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "cloudinary_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."listing_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "decision" "app"."ReviewDecision" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."saved_listings" (
    "buyer_user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("buyer_user_id","listing_id")
);

-- CreateTable
CREATE TABLE "app"."orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "package_plan_id" UUID NOT NULL,
    "lead_count" INTEGER NOT NULL,
    "price_pkr" BIGINT NOT NULL,
    "price_per_lead_pkr" BIGINT NOT NULL,
    "status" "app"."OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "window_starts_at" TIMESTAMPTZ(6),
    "window_ends_at" TIMESTAMPTZ(6),
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "amount_pkr" BIGINT NOT NULL,
    "status" "app"."PaymentStatus" NOT NULL,
    "raw" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."cashbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "undelivered_count" INTEGER NOT NULL,
    "amount_pkr" BIGINT NOT NULL,
    "status" "app"."CashbackStatus" NOT NULL DEFAULT 'PENDING',
    "provider_ref" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone_hash" TEXT NOT NULL,
    "phone_enc" TEXT,
    "name" TEXT,
    "first_source" "app"."ContactSource" NOT NULL,
    "dnc" BOOLEAN NOT NULL DEFAULT false,
    "dnc_reason" "app"."DncReason",
    "dnc_at" TIMESTAMPTZ(6),
    "purge_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."contact_cap_counters" (
    "contact_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "listings_sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contact_cap_counters_pkey" PRIMARY KEY ("contact_id","period_start")
);

-- CreateTable
CREATE TABLE "app"."prospect_outreach" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "master_listing_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "selected_by_id" UUID NOT NULL,
    "status" "app"."ProspectStatus" NOT NULL DEFAULT 'SELECTED',
    "converted_user_id" UUID,
    "converted_listing_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "status" "app"."CampaignStatus" NOT NULL DEFAULT 'PLANNED',
    "match_params" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."campaign_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "source_master_listing_id" UUID,
    "score" DECIMAL(8,4) NOT NULL,
    "status" "app"."TargetStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "direction" "app"."Direction" NOT NULL,
    "channel" "app"."Channel" NOT NULL,
    "campaign_target_id" UUID,
    "prospect_outreach_id" UUID,
    "template_id" UUID,
    "body" TEXT NOT NULL,
    "wa_message_id" TEXT,
    "status" "app"."MessageStatus" NOT NULL,
    "sent_by_user_id" UUID,
    "intent" "app"."Intent",
    "intent_confidence" DECIMAL(4,3),
    "classifier_model" TEXT,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."form_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "kind" "app"."FormKind" NOT NULL,
    "contact_id" UUID NOT NULL,
    "listing_id" UUID,
    "master_listing_id" UUID,
    "campaign_target_id" UUID,
    "prospect_outreach_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "opened_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "form_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."form_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_link_id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "source" "app"."LeadSource" NOT NULL,
    "counts_toward_order" BOOLEAN NOT NULL,
    "buyer_name" TEXT,
    "budget_min_pkr" BIGINT,
    "budget_max_pkr" BIGINT,
    "timeline" TEXT,
    "note" TEXT,
    "status" "app"."LeadStatus" NOT NULL DEFAULT 'DELIVERED',
    "customer_stage" "app"."CustomerStage" NOT NULL DEFAULT 'NEW',
    "follow_up_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."lead_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "app"."ReportStatus" NOT NULL DEFAULT 'OPEN',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,

    CONSTRAINT "lead_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intel"."area_benchmarks" (
    "locality_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "size_band" TEXT NOT NULL,
    "median_price_per_sqft" DECIMAL(14,2) NOT NULL,
    "p25" DECIMAL(14,2) NOT NULL,
    "p75" DECIMAL(14,2) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "area_benchmarks_pkey" PRIMARY KEY ("locality_id","category","purpose","size_band")
);

-- CreateTable
CREATE TABLE "intel"."listing_scores" (
    "master_listing_id" UUID NOT NULL,
    "quality_score" DECIMAL(8,4) NOT NULL,
    "price_deviation_pct" DECIMAL(8,2),
    "predicted_price_pkr" BIGINT,
    "exit_prob_30d" DECIMAL(5,4),
    "propensity_score" DECIMAL(8,4) NOT NULL,
    "rank_score" DECIMAL(8,4) NOT NULL,
    "model_version" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "listing_scores_pkey" PRIMARY KEY ("master_listing_id")
);

-- CreateTable
CREATE TABLE "intel"."listing_clusters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canonical_master_listing_id" UUID NOT NULL,
    "member_ids" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intel"."seller_contact_links" (
    "contact_id" UUID NOT NULL,
    "master_listing_id" UUID NOT NULL,

    CONSTRAINT "seller_contact_links_pkey" PRIMARY KEY ("contact_id","master_listing_id")
);

-- CreateTable
CREATE TABLE "ops"."job_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ops"."JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ops"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "emailed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops"."audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zameen"."listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL DEFAULT 'zameen',
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "price_raw" TEXT,
    "price_pkr" BIGINT,
    "size_raw" TEXT,
    "size_value" DECIMAL(12,2),
    "size_unit" TEXT,
    "size_sqft" DECIMAL(12,2),
    "city" TEXT NOT NULL,
    "locality" TEXT,
    "location_text" TEXT,
    "listed_at" TIMESTAMPTZ(6) NOT NULL,
    "listed_at_precision" TEXT NOT NULL,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "amenities" TEXT[],
    "seller_name" TEXT,
    "agency_name" TEXT,
    "agency_profile_url" TEXT,
    "is_agency" BOOLEAN,
    "phone_enc" TEXT,
    "phone_hash" TEXT,
    "added_date_raw" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "image_urls" TEXT[],
    "is_verified" BOOLEAN,
    "is_featured" BOOLEAN,
    "product" TEXT,
    "agency_tier" TEXT,
    "agency_since" TIMESTAMPTZ(6),
    "completion_status" TEXT,
    "built_year" INTEGER,
    "floors" INTEGER,
    "raw" JSONB NOT NULL,
    "master_rejected_reason" TEXT,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olx"."listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL DEFAULT 'olx',
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "price_raw" TEXT,
    "price_pkr" BIGINT,
    "size_raw" TEXT,
    "size_value" DECIMAL(12,2),
    "size_unit" TEXT,
    "size_sqft" DECIMAL(12,2),
    "city" TEXT NOT NULL,
    "locality" TEXT,
    "location_text" TEXT,
    "listed_at" TIMESTAMPTZ(6) NOT NULL,
    "listed_at_precision" TEXT NOT NULL,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "amenities" TEXT[],
    "seller_name" TEXT,
    "agency_name" TEXT,
    "agency_profile_url" TEXT,
    "is_agency" BOOLEAN,
    "phone_enc" TEXT,
    "phone_hash" TEXT,
    "added_date_raw" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "image_urls" TEXT[],
    "is_verified" BOOLEAN,
    "is_featured" BOOLEAN,
    "product" TEXT,
    "is_furnished" BOOLEAN,
    "floor_level" INTEGER,
    "portal_expires_at" TIMESTAMPTZ(6),
    "raw" JSONB NOT NULL,
    "master_rejected_reason" TEXT,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graana"."listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL DEFAULT 'graana',
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "price_raw" TEXT,
    "price_pkr" BIGINT,
    "size_raw" TEXT,
    "size_value" DECIMAL(12,2),
    "size_unit" TEXT,
    "size_sqft" DECIMAL(12,2),
    "city" TEXT NOT NULL,
    "locality" TEXT,
    "location_text" TEXT,
    "listed_at" TIMESTAMPTZ(6) NOT NULL,
    "listed_at_precision" TEXT NOT NULL,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "amenities" TEXT[],
    "seller_name" TEXT,
    "agency_name" TEXT,
    "agency_profile_url" TEXT,
    "is_agency" BOOLEAN,
    "phone_enc" TEXT,
    "phone_hash" TEXT,
    "added_date_raw" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "image_urls" TEXT[],
    "agency_since" TIMESTAMPTZ(6),
    "condition" TEXT,
    "portal_expires_at" TIMESTAMPTZ(6),
    "raw" JSONB NOT NULL,
    "master_rejected_reason" TEXT,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ilaan"."listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL DEFAULT 'ilaan',
    "external_id" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "price_raw" TEXT,
    "price_pkr" BIGINT,
    "size_raw" TEXT,
    "size_value" DECIMAL(12,2),
    "size_unit" TEXT,
    "size_sqft" DECIMAL(12,2),
    "city" TEXT NOT NULL,
    "locality" TEXT,
    "location_text" TEXT,
    "listed_at" TIMESTAMPTZ(6) NOT NULL,
    "listed_at_precision" TEXT NOT NULL,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "amenities" TEXT[],
    "seller_name" TEXT,
    "agency_name" TEXT,
    "agency_profile_url" TEXT,
    "is_agency" BOOLEAN,
    "phone_enc" TEXT,
    "phone_hash" TEXT,
    "added_date_raw" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "image_urls" TEXT[],
    "is_verified" BOOLEAN,
    "is_featured" BOOLEAN,
    "is_gold_verified" BOOLEAN,
    "raw" JSONB NOT NULL,
    "master_rejected_reason" TEXT,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master"."listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "price_raw" TEXT NOT NULL,
    "price_pkr" BIGINT NOT NULL,
    "size_raw" TEXT NOT NULL,
    "size_value" DECIMAL(12,2) NOT NULL,
    "size_unit" TEXT NOT NULL,
    "size_sqft" DECIMAL(12,2) NOT NULL,
    "city" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "location_text" TEXT NOT NULL,
    "listed_at" TIMESTAMPTZ(6) NOT NULL,
    "listed_at_precision" TEXT NOT NULL,
    "scraped_at" TIMESTAMPTZ(6) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_hash" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT,
    "amenities" TEXT[],
    "seller_name" TEXT,
    "agency_name" TEXT,
    "agency_profile_url" TEXT,
    "is_agency" BOOLEAN,
    "phone_enc" TEXT,
    "phone_hash" TEXT,
    "added_date_raw" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "image_urls" TEXT[],
    "is_verified" BOOLEAN,
    "is_featured" BOOLEAN,
    "portal_expires_at" TIMESTAMPTZ(6),
    "agency_since" TIMESTAMPTZ(6),
    "built_year" INTEGER,
    "is_furnished" BOOLEAN,
    "floor_level" INTEGER,
    "zameen_product" TEXT,
    "zameen_agency_tier" TEXT,
    "zameen_completion_status" TEXT,
    "zameen_floors" INTEGER,
    "olx_product" TEXT,
    "graana_condition" TEXT,
    "ilaan_is_gold_verified" BOOLEAN,
    "source_row_id" UUID NOT NULL,
    "source_schema" TEXT NOT NULL,
    "cluster_id" UUID,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master"."listing_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "listing_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "old" JSONB,
    "new" JSONB,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master"."crawl_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "trigger" TEXT NOT NULL,
    "window_hours" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master"."crawl_run_portals" (
    "run_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "pages_fetched" INTEGER,
    "items_seen" INTEGER,
    "items_new" INTEGER,
    "items_updated" INTEGER,
    "items_rejected" INTEGER,
    "errors" INTEGER,
    "status" TEXT NOT NULL,

    CONSTRAINT "crawl_run_portals_pkey" PRIMARY KEY ("run_id","platform")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "config"."regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "config"."regions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "localities_region_id_slug_key" ON "config"."localities"("region_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "portals_slug_key" ON "config"."portals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "portal_region_maps_portal_id_region_id_key" ON "config"."portal_region_maps"("portal_id", "region_id");

-- CreateIndex
CREATE UNIQUE INDEX "crawl_segments_portal_id_region_id_category_purpose_key" ON "config"."crawl_segments"("portal_id", "region_id", "category", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "lead_criteria_version_key" ON "config"."lead_criteria"("version");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_key_key" ON "config"."message_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "app"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "app"."users"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "app"."sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "app"."sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "app"."verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_type_idx" ON "app"."verification_tokens"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_profiles_contact_id_key" ON "app"."buyer_profiles"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "app"."listings"("slug");

-- CreateIndex
CREATE INDEX "listings_status_region_id_locality_id_category_purpose_idx" ON "app"."listings"("status", "region_id", "locality_id", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_customer_id_idx" ON "app"."listings"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_listing_id_position_key" ON "app"."listing_images"("listing_id", "position");

-- CreateIndex
CREATE INDEX "listing_reviews_listing_id_idx" ON "app"."listing_reviews"("listing_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "app"."orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_window_ends_at_idx" ON "app"."orders"("status", "window_ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "app"."payments"("provider_ref");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "app"."payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "cashbacks_order_id_key" ON "app"."cashbacks"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_phone_hash_key" ON "app"."contacts"("phone_hash");

-- CreateIndex
CREATE INDEX "contacts_purge_at_idx" ON "app"."contacts"("purge_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_outreach_master_listing_id_key" ON "app"."prospect_outreach"("master_listing_id");

-- CreateIndex
CREATE INDEX "prospect_outreach_contact_id_idx" ON "app"."prospect_outreach"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_order_id_key" ON "app"."campaigns"("order_id");

-- CreateIndex
CREATE INDEX "campaign_targets_status_idx" ON "app"."campaign_targets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_targets_campaign_id_contact_id_key" ON "app"."campaign_targets"("campaign_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_wa_message_id_key" ON "app"."messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "messages_contact_id_created_at_idx" ON "app"."messages"("contact_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "form_links_token_hash_key" ON "app"."form_links"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "form_submissions_form_link_id_key" ON "app"."form_submissions"("form_link_id");

-- CreateIndex
CREATE INDEX "leads_customer_id_delivered_at_idx" ON "app"."leads"("customer_id", "delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_contact_id_listing_id_key" ON "app"."leads"("contact_id", "listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_reports_lead_id_key" ON "app"."lead_reports"("lead_id");

-- CreateIndex
CREATE INDEX "seller_contact_links_master_listing_id_idx" ON "intel"."seller_contact_links"("master_listing_id");

-- CreateIndex
CREATE INDEX "job_requests_status_created_at_idx" ON "ops"."job_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "ops"."notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "ops"."audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_created_at_idx" ON "ops"."audit_log"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "listings_city_locality_category_purpose_idx" ON "zameen"."listings"("city", "locality", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_price_pkr_idx" ON "zameen"."listings"("price_pkr");

-- CreateIndex
CREATE INDEX "listings_listed_at_idx" ON "zameen"."listings"("listed_at");

-- CreateIndex
CREATE INDEX "listings_last_seen_at_idx" ON "zameen"."listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "listings_phone_hash_idx" ON "zameen"."listings"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "listings_platform_external_id_key" ON "zameen"."listings"("platform", "external_id");

-- CreateIndex
CREATE INDEX "listings_city_locality_category_purpose_idx" ON "olx"."listings"("city", "locality", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_price_pkr_idx" ON "olx"."listings"("price_pkr");

-- CreateIndex
CREATE INDEX "listings_listed_at_idx" ON "olx"."listings"("listed_at");

-- CreateIndex
CREATE INDEX "listings_last_seen_at_idx" ON "olx"."listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "listings_phone_hash_idx" ON "olx"."listings"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "listings_platform_external_id_key" ON "olx"."listings"("platform", "external_id");

-- CreateIndex
CREATE INDEX "listings_city_locality_category_purpose_idx" ON "graana"."listings"("city", "locality", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_price_pkr_idx" ON "graana"."listings"("price_pkr");

-- CreateIndex
CREATE INDEX "listings_listed_at_idx" ON "graana"."listings"("listed_at");

-- CreateIndex
CREATE INDEX "listings_last_seen_at_idx" ON "graana"."listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "listings_phone_hash_idx" ON "graana"."listings"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "listings_platform_external_id_key" ON "graana"."listings"("platform", "external_id");

-- CreateIndex
CREATE INDEX "listings_city_locality_category_purpose_idx" ON "ilaan"."listings"("city", "locality", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_price_pkr_idx" ON "ilaan"."listings"("price_pkr");

-- CreateIndex
CREATE INDEX "listings_listed_at_idx" ON "ilaan"."listings"("listed_at");

-- CreateIndex
CREATE INDEX "listings_last_seen_at_idx" ON "ilaan"."listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "listings_phone_hash_idx" ON "ilaan"."listings"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "listings_platform_external_id_key" ON "ilaan"."listings"("platform", "external_id");

-- CreateIndex
CREATE INDEX "listings_city_locality_category_purpose_idx" ON "master"."listings"("city", "locality", "category", "purpose");

-- CreateIndex
CREATE INDEX "listings_price_pkr_idx" ON "master"."listings"("price_pkr");

-- CreateIndex
CREATE INDEX "listings_listed_at_idx" ON "master"."listings"("listed_at");

-- CreateIndex
CREATE INDEX "listings_last_seen_at_idx" ON "master"."listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "listings_phone_hash_idx" ON "master"."listings"("phone_hash");

-- CreateIndex
CREATE INDEX "listings_cluster_id_idx" ON "master"."listings"("cluster_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_platform_external_id_key" ON "master"."listings"("platform", "external_id");

-- CreateIndex
CREATE INDEX "listing_events_platform_listing_id_at_idx" ON "master"."listing_events"("platform", "listing_id", "at");

-- CreateIndex
CREATE INDEX "crawl_runs_status_started_at_idx" ON "master"."crawl_runs"("status", "started_at");

-- AddForeignKey
ALTER TABLE "config"."localities" ADD CONSTRAINT "localities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "config"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config"."localities" ADD CONSTRAINT "localities_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "config"."localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config"."portal_region_maps" ADD CONSTRAINT "portal_region_maps_portal_id_fkey" FOREIGN KEY ("portal_id") REFERENCES "config"."portals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config"."portal_region_maps" ADD CONSTRAINT "portal_region_maps_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "config"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config"."crawl_segments" ADD CONSTRAINT "crawl_segments_portal_id_fkey" FOREIGN KEY ("portal_id") REFERENCES "config"."portals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config"."crawl_segments" ADD CONSTRAINT "crawl_segments_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "config"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."buyer_profiles" ADD CONSTRAINT "buyer_profiles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listings" ADD CONSTRAINT "listings_master_listing_id_fkey" FOREIGN KEY ("master_listing_id") REFERENCES "master"."listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listing_images" ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."listing_reviews" ADD CONSTRAINT "listing_reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."saved_listings" ADD CONSTRAINT "saved_listings_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."saved_listings" ADD CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_package_plan_id_fkey" FOREIGN KEY ("package_plan_id") REFERENCES "config"."package_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."cashbacks" ADD CONSTRAINT "cashbacks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."contact_cap_counters" ADD CONSTRAINT "contact_cap_counters_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."prospect_outreach" ADD CONSTRAINT "prospect_outreach_master_listing_id_fkey" FOREIGN KEY ("master_listing_id") REFERENCES "master"."listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."prospect_outreach" ADD CONSTRAINT "prospect_outreach_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaigns" ADD CONSTRAINT "campaigns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaigns" ADD CONSTRAINT "campaigns_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaign_targets" ADD CONSTRAINT "campaign_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "app"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaign_targets" ADD CONSTRAINT "campaign_targets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campaign_targets" ADD CONSTRAINT "campaign_targets_source_master_listing_id_fkey" FOREIGN KEY ("source_master_listing_id") REFERENCES "master"."listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_campaign_target_id_fkey" FOREIGN KEY ("campaign_target_id") REFERENCES "app"."campaign_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_prospect_outreach_id_fkey" FOREIGN KEY ("prospect_outreach_id") REFERENCES "app"."prospect_outreach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."form_links" ADD CONSTRAINT "form_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."form_links" ADD CONSTRAINT "form_links_campaign_target_id_fkey" FOREIGN KEY ("campaign_target_id") REFERENCES "app"."campaign_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."form_links" ADD CONSTRAINT "form_links_prospect_outreach_id_fkey" FOREIGN KEY ("prospect_outreach_id") REFERENCES "app"."prospect_outreach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."form_submissions" ADD CONSTRAINT "form_submissions_form_link_id_fkey" FOREIGN KEY ("form_link_id") REFERENCES "app"."form_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "app"."listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."leads" ADD CONSTRAINT "leads_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."lead_reports" ADD CONSTRAINT "lead_reports_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "app"."leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intel"."listing_scores" ADD CONSTRAINT "listing_scores_master_listing_id_fkey" FOREIGN KEY ("master_listing_id") REFERENCES "master"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intel"."seller_contact_links" ADD CONSTRAINT "seller_contact_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intel"."seller_contact_links" ADD CONSTRAINT "seller_contact_links_master_listing_id_fkey" FOREIGN KEY ("master_listing_id") REFERENCES "master"."listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master"."crawl_run_portals" ADD CONSTRAINT "crawl_run_portals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "master"."crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CHECK constraints (SPEC_01 3.1, 3.6). Prisma cannot express these.
-- ---------------------------------------------------------------------------

ALTER TABLE "zameen"."listings" ADD CONSTRAINT "listings_platform_check" CHECK (platform = 'zameen');
ALTER TABLE "olx"."listings"    ADD CONSTRAINT "listings_platform_check" CHECK (platform = 'olx');
ALTER TABLE "graana"."listings" ADD CONSTRAINT "listings_platform_check" CHECK (platform = 'graana');
ALTER TABLE "ilaan"."listings"  ADD CONSTRAINT "listings_platform_check" CHECK (platform = 'ilaan');
ALTER TABLE "master"."listings" ADD CONSTRAINT "listings_platform_check"
  CHECK (platform IN ('zameen', 'olx', 'graana', 'ilaan'));

DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['zameen', 'olx', 'graana', 'ilaan', 'master'] LOOP
    EXECUTE format('ALTER TABLE %I.listings ADD CONSTRAINT listings_purpose_check CHECK (purpose IN (''sale'', ''rent''))', s);
    EXECUTE format('ALTER TABLE %I.listings ADD CONSTRAINT listings_listed_at_precision_check CHECK (listed_at_precision IN (''exact'', ''estimated''))', s);
    EXECUTE format('ALTER TABLE %I.listings ADD CONSTRAINT listings_size_unit_check CHECK (size_unit IN (''marla'', ''kanal'', ''sqft'', ''sqyd'', ''sqm''))', s);
  END LOOP;
END $$;

ALTER TABLE "master"."listings" ADD CONSTRAINT "listings_source_schema_check"
  CHECK (source_schema IN ('zameen', 'olx', 'graana', 'ilaan') AND source_schema = platform);

ALTER TABLE "master"."listing_events" ADD CONSTRAINT "listing_events_platform_check"
  CHECK (platform IN ('zameen', 'olx', 'graana', 'ilaan'));
ALTER TABLE "master"."listing_events" ADD CONSTRAINT "listing_events_type_check"
  CHECK (type IN ('PRICE_CHANGE', 'EDIT'));

ALTER TABLE "master"."crawl_runs" ADD CONSTRAINT "crawl_runs_trigger_check"
  CHECK (trigger IN ('schedule', 'manual', 'catchup'));
ALTER TABLE "master"."crawl_runs" ADD CONSTRAINT "crawl_runs_status_check"
  CHECK (status IN ('running', 'success', 'partial', 'failed'));
ALTER TABLE "master"."crawl_runs" ADD CONSTRAINT "crawl_runs_window_hours_check"
  CHECK (window_hours > 0);

ALTER TABLE "master"."crawl_run_portals" ADD CONSTRAINT "crawl_run_portals_platform_check"
  CHECK (platform IN ('zameen', 'olx', 'graana', 'ilaan'));
ALTER TABLE "master"."crawl_run_portals" ADD CONSTRAINT "crawl_run_portals_status_check"
  CHECK (status IN ('running', 'success', 'failed', 'skipped'));
