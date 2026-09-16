# prisma

One schema file for every Postgres schema (`multiSchema`). Python reads and writes the same
tables with plain SQL.

Rules:
- Change the database only through migrations: `npx prisma migrate dev --create-only --name <what>`,
  review the SQL, then `npx prisma migrate dev`. Production runs `npx prisma migrate deploy`.
  Never `db push`.
- Ids and timestamps default in the database (`gen_random_uuid()`, `now()`), not in the client,
  because Python inserts rows too.
- Prisma cannot express CHECK constraints. They are written by hand at the end of the
  migration SQL. Search the migrations for `CHECK` before changing an allowed value.
- A migration that drops or rewrites a column must first move the data (see
  `20261110190000_single_phone_store_lifecycle_and_job_reliability`).
- Tests use a separate database: `DATABASE_URL=.../leads_test npx prisma migrate deploy`.

| Schema | Holds |
|---|---|
| `zameen`, `olx`, `graana`, `ilaan` | one `listings` table per portal: common columns, that portal's own columns, `raw jsonb` |
| `master` | `listings` (union of all portals), `listing_events`, `crawl_runs`, `crawl_run_portals` |
| `config` | regions, localities, portals, city mappings, crawl segments, criteria, plans, templates, settings |
| `app` | users, sessions, contacts, customer listings, orders, payments, campaigns, messages, forms, leads |
| `intel` | benchmarks, scores, clusters, seller-contact links |
| `ops` | job requests, heartbeats, notifications, audit log |
| `public` | legacy tables from before v4 (`Legacy*` models), to be dropped |
