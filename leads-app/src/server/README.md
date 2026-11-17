# src/server

Server-only code. Every file imports `server-only`, so it can never end up in a browser bundle.

| Folder | Holds |
|---|---|
| `auth/` | access tokens (`tokens.ts`), cookies, sessions and refresh rotation (`session.ts`), the permission map, passwords, one-time codes, TOTP, Google sign-in |
| `crypto/` | AES-GCM (`aead.ts`) and phone hashing/encryption, byte-compatible with the Python service |
| `http/` | `route()` wrapper, errors, response envelope, rate limits, client IP |
| `integrations/` | email (Resend), media (Cloudinary; disk in development), Gemini |
| `modules/<name>/` | one folder per business area: `service.ts`, `schema.ts` (Zod), `rules.ts` (pure logic) |
| `pages.ts` | helpers for server components: `requireCustomer`, `requireGuest`, `orNotFound`, `pageId` |
| `db.ts`, `env.ts` | the Prisma client, and the validated environment (read env only through `env()`) |

Rules:
- Route handlers stay thin: `route()` checks origin, rate limits, session and permission, and
  validates input; the handler calls one service function.
- Every query on customer data is scoped by the owner's id inside the service. Someone else's id
  behaves exactly like a missing one (404).
- Services throw `AppError` for anything the user should see; anything else becomes a logged 500
  with a generic message.
- Cities, areas, plans and tunable rules come from the `config` schema (`modules/catalog`,
  `modules/settings`), never from constants.
- The web app never calls the Python service. Background work is an `ops.job_requests` row.
