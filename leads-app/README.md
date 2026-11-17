# leads-app

The LEADS web app (Next.js 16, App Router, TypeScript strict) and, in `python-service/`, the
crawler and background workers. Both use the same PostgreSQL database; they never call each other
over HTTP (the web app writes `ops.job_requests` rows, the workers pick them up).

## Run it locally

```bash
docker compose up -d                       # from the repo root: postgres + redis
cp .env.example .env                       # fill in the secrets it lists
npm install
npm run db:deploy                          # apply migrations
(cd python-service && python scripts/seed_config.py)   # cities, areas, portals, package plans
npm run db:seed:dev                        # demo accounts and data (development only)
npm run dev                                # http://localhost:3000
```

Demo logins: `demo@leads.pk` (agency) and `owner@leads.pk` (owner), password `password1`.
For the first admin: `npm run admin:create -- --email you@example.com --name "Your Name"`
(prints a one-time password and the authenticator setup link).

Set `AUTH_DELIVERY=log` to print email and WhatsApp codes to the server log instead of sending
them, and `PAYMENT_PROVIDER=sandbox` to confirm card and wallet payments on the spot.

## Checks

```bash
npm run typecheck && npm run lint && npm test   # unit tests
npm run test:integration                        # database constraints (leads_test database)
npm run test:e2e                                # Playwright, against a dev server
```

## Layout

| Path | What lives there |
|---|---|
| `app/(marketing)`, `app/(auth)`, `app/(app)` | pages: public site, sign-in screens, the signed-in customer app |
| `app/api/**/route.ts` | API handlers, each a thin `route({ auth, body, query, handler })` |
| `src/server/` | server-only code: auth, HTTP plumbing, business modules (see its README) |
| `src/components/` | UI: `ui/` primitives, `app/`, `auth/`, `marketing/` screens |
| `src/lib/` | code safe in the browser: `api.ts` (API client), formatting, labels |
| `src/types/api.ts` | the shapes the UI and the API agree on |
| `prisma/` | schema and migrations for every Postgres schema |
| `scripts/` | `dev-seed.ts`, `admin-create.ts` |
| `e2e/`, `test/` | Playwright specs, integration tests |

## Auth in one paragraph

Signing in sets two httpOnly cookies: a 15-minute JWT access token and an opaque refresh token
(only its hash is stored, in `app.sessions`). Every request checks the session row the JWT names,
so logout and suspension apply immediately. The refresh token rotates on each use, and a replayed
old one ends the session. No token is ever readable from page scripts or kept in browser storage.
