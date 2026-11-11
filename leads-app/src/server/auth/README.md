# auth

Status: not built yet. Replaces the JWT code in `src/lib/auth`.

- `session.ts`: create, read and revoke sessions. The cookie `leads_token` carries a random
  32-byte token; the database stores only its SHA-256 (`app.sessions.token_hash`).
- `password.ts`: bcrypt cost 12; lock for 15 minutes after 5 failed logins.
- `guards.ts`: `requireUser()`, `requireRole('ADMIN')`, `requireCustomer()`. Middleware only
  redirects; every route handler calls a guard again.
- `tokens.ts`: email verification (24 h), password reset (1 h), phone OTP (10 min, 5 attempts),
  all stored hashed in `app.verification_tokens`.

Tables: `app.users`, `app.sessions`, `app.verification_tokens`.
