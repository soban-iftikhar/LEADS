# infra

Everything needed to run LEADS outside a developer laptop.

| Folder | Holds |
|---|---|
| `docker/` | Dockerfiles for the web app and the Python workers |

Compose files stay at the repository root: `docker-compose.yml` (dev: postgres + redis) and
`docker-compose.prod.yml` (full stack).

CI runs from `.github/workflows/ci.yml` on every push and pull request.
