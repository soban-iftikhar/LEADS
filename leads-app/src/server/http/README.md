# http

Status: not built yet.

- `errors.ts`: maps thrown errors to `{ "error": { "code", "message", "fields" } }`. Never
  returns stack traces or database messages.
- `pagination.ts`: cursor pagination, `?cursor=<id>&limit=<1..100>` -> `{ items, nextCursor }`.
- `rate-limit.ts`: Redis sliding-window counters. Uses the socket IP or a signed ingress
  header, never `x-forwarded-for`.
- `json.ts`: money as strings of whole PKR (BigInt-safe), dates as ISO 8601 UTC.
