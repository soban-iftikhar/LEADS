# infra

Everything needed to run LEADS outside a developer laptop.

| Folder | Holds |
|---|---|
| `docker/` | Dockerfiles for the web app and the Python workers |
| `backup/` | database backup and restore scripts |
| `monitoring/` | health checks and alert rules |
| `ci/` | CI pipeline notes (the workflow files live in `.github/workflows/`) |

Compose files stay at the repository root: `docker-compose.yml` (dev: postgres + redis) and
`docker-compose.prod.yml` (full stack).
