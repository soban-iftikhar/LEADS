# modules

One folder per business module. Each holds:

- `schema.ts`: Zod schemas for every input the module accepts
- `repo.ts`: all Prisma queries for the module's tables
- `service.ts`: business rules; calls its own repo and other modules' services, never their repos
- `*.test.ts`: tests next to the code

| Module | Does | Tables |
|---|---|---|
| `auth/` | Signup, login, logout, email and phone verification, password reset. | `app.users, app.sessions, app.verification_tokens` |
| `users/` | Profiles for customers and buyers; admin user management. | `app.users, app.customer_profiles, app.buyer_profiles` |
| `listings/` | Customer listings on LEADS: create, edit, images, status changes. | `app.listings, app.listing_images` |
| `reviews/` | Listing quality gate and admin review (approve, reject, need info). | `app.listing_reviews, config.lead_criteria` |
| `catalog/` | Public search and listing pages. Only APPROVED listings. | `app.listings (read), app.saved_listings` |
| `packages/` | Package plans and orders; delivery window; delivered count. | `config.package_plans, app.orders` |
| `payments/` | PaymentProvider interface; ManualProvider first; cashback. | `app.payments, app.cashbacks` |
| `leads/` | Lead inbox for customers; one lead per (contact, listing). | `app.leads` |
| `reports/` | Bad-lead reports and admin decisions. | `app.lead_reports` |
| `buyers/` | Buyer accounts: saved listings, inquiries that become leads. | `app.buyer_profiles, app.saved_listings` |
| `campaigns/` | Admin view of campaigns and targets. The campaign agent runs in Python. | `app.campaigns, app.campaign_targets` |
| `prospects/` | Admin selection of portal sellers to convert into customers. | `app.prospect_outreach` |
| `messaging/` | Send queue (WA_LINK mode), log reply, WhatsApp webhook intake. | `app.messages, config.message_templates` |
| `forms/` | Public forms opened from a tokenised link. | `app.form_links, app.form_submissions` |
| `notifications/` | In-app notifications; email digest is sent by Python. | `ops.notifications` |
| `settings/` | Admin settings: channel, caps, quiet hours, crawl schedule. | `config.app_settings` |
| `geo/` | Regions, localities, portal city mappings, crawl segments. | `config.regions, config.localities, config.portals, config.portal_region_maps, config.crawl_segments` |
| `crawl/` | Read-only data explorer for scraped listings and crawl runs; manual run requests. | `master.listings, master.crawl_runs, master.crawl_run_portals, ops.job_requests` |
| `intel/` | Read-only views of benchmarks, scores and ranking for the admin console. | `intel.*` |
| `audit/` | Writes and reads the audit log for admin actions and status changes. | `ops.audit_log` |

A module owns its tables. Another module that needs that data asks the owning module's
service, so a rule (for example "customers only see their own leads") is enforced in one place.
