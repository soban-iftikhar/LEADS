# src/server

Server-only code for the web app. Every file here starts with `import 'server-only'`
and is never imported from client components.

| Folder | Holds |
|---|---|
| `auth/` | sessions, password hashing, guards (`requireUser`, `requireRole`, `requireCustomer`) |
| `crypto/` | phone hash + encryption, token hashing |
| `http/` | error mapper, cursor pagination, rate limiting |
| `modules/<name>/` | one folder per business module: `service.ts`, `repo.ts`, `schema.ts` (Zod), `*.test.ts` |

Files that belong at this level: `db.ts` (Prisma client singleton) and `env.ts`
(Zod-validated environment; the app refuses to boot if it is invalid).

Rules:
- Route handlers in `app/api/**` stay thin: parse input with the module's Zod schema,
  call the module's service, map errors with `http/`.
- Only `repo.ts` files talk to Prisma. Services never build queries inline.
- Every query on customer data filters by the owning `customerId`.
- The web app never calls the Python service. To start background work it inserts a
  row in `ops.job_requests`; results come back as rows.
