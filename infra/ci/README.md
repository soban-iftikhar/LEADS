# infra/ci

Status: not built yet. Workflow files go in `.github/workflows/`.

On every pull request:
- web: `npm run lint`, `npm run typecheck`, `npm test`, `npx prisma validate`,
  and `prisma migrate deploy` against a fresh Postgres service container
- python: `ruff check .`, `pytest` against the same migrated database
