-- Remove the summer 2026 scrape tables (DR-34).
-- public.properties stored seller phone numbers in plain text; it was replaced by the
-- portal schemas + master.listings, where phones live only encrypted in app.contacts.
-- public.prospects tracked outreach to those rows and goes with them.
-- The data is intentionally discarded (approved by the project owner, 11 Nov 2026).

DROP TABLE IF EXISTS "public"."prospects";
DROP TABLE IF EXISTS "public"."properties";
DROP TYPE IF EXISTS "public"."ProspectStatus";
