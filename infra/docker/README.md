# infra/docker

Images and the production stack for LEADS. The compose file is at the repository root:
`docker-compose.prod.yml`.

| File | Image | Runs |
|---|---|---|
| `worker.Dockerfile` | `python:3.12-slim` | Celery workers, beat, the seed job and the cron fallback script |
| `migrate.Dockerfile` | `node:22-alpine` | `npx prisma migrate deploy`, once per deploy |
| `web.Dockerfile` | `node:22-alpine`, multi-stage | Next.js app (compose profile `web`) |

## Services

| Service | Command | Replicas |
|---|---|---|
| `postgres` | postgres:17, named volume, port bound to 127.0.0.1 only | 1 |
| `redis` | redis:7.4, AOF on, named volume | 1 |
| `migrate` | `prisma migrate deploy`, then exits | once per deploy |
| `seed` | `python scripts/seed_config.py`, then exits | once per deploy |
| `worker-crawl` | `celery -A celery_app worker -Q crawl -c 2` | 1 or more |
| `worker-main` | `celery -A celery_app worker -Q default,intel,agents,messaging -c 2` | 1 or more |
| `beat` | `celery -A celery_app beat --schedule /data/celerybeat-schedule` | **exactly 1** |
| `web` | `next start` (profile `web`) | 1 or more |

Start order is enforced: postgres healthy -> migrate -> seed -> workers and beat. Every
long-running service has a health check and `restart: unless-stopped`.

## Deploy the scraping engine on a VPS

Needs Docker with the compose plugin, 2 GB RAM or more.

```bash
git clone <repo> leads && cd leads
cp .env.prod.example .env.prod          # then fill it in (see below)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

That is the whole deploy. On a new database the workers notice there has never been a crawl
and start a catch-up run about 30 seconds after they come up. After that the crawl runs every
day at 02:00 Asia/Karachi.

`.env.prod` values you must set:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | long random string |
| `PHONE_HASH_PEPPER`, `PHONE_ENC_KEY` | `head -c 32 /dev/urandom \| base64` each. Back them up away from the database. If `PHONE_ENC_KEY` is lost, stored phones cannot be read. Never change them once data exists. |
| `OLX_ACCESS_TOKEN`, `OLX_ID_TOKEN` | cookies `kc_access_token`, `kc_id_token` from a logged-in olx.com.pk session |
| `ILAAN_AUTH_TOKEN`, `ILAAN_CSRF_TOKEN` | cookie `auth_token` and request header `X-CSRF-Token` from a logged-in ilaan.com session |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_ALERT_EMAIL` | for failure emails; without them alerts are only logged |

When a portal token expires, edit `.env.prod` and run the same `up -d` command; only the
changed services restart.

## Day-to-day

```bash
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"

$DC logs -f worker-crawl beat                 # live logs
$DC exec worker-crawl ls logs                 # one log file per spider run
$DC up -d --scale worker-crawl=2              # more crawl capacity (never scale beat)
$DC up -d --build                             # deploy a new version

# run a crawl now, all portals or selected ones
$DC exec worker-crawl python scripts/daily_scrape.py --trigger manual
$DC exec worker-crawl python scripts/daily_scrape.py --trigger manual --portal olx --portal ilaan

# what happened
$DC exec postgres sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  select started_at, trigger, status, error from master.crawl_runs order by started_at desc limit 7"'
$DC exec postgres sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "
  select platform, status, pages_fetched, items_seen, items_new, errors, error
  from master.crawl_run_portals order by started_at desc nulls last limit 8"'
```

Run status: `success` = every portal fine; `partial` = a portal failed, was mostly blocked, or
a login token expired; `failed` = nothing worked. An email goes out on `failed`, and on
`partial` two runs in a row.

## How the schedule stays reliable

- **One run per day.** A Redis lock (`lock:daily_refresh:<date>`) and a unique
  `master.crawl_runs.lock_key` in Postgres. A second trigger for the same day exits.
- **Catch-up.** On worker start and every hour: if the last good run is more than 25 h old and
  nothing is running, a `catchup` run starts. A run stuck for 4 h is closed as failed first.
- **Time limits.** Each spider closes itself after 1 h 50 min; the task is stopped at 2 h
  (soft) and 2.5 h (hard). Celery's Redis visibility timeout is 4 h, so a long crawl is never
  delivered twice.
- **Beat state** is on the `beat_data` volume, so a restart does not re-fire old schedules.
- **Crashes.** `acks_late` + `reject_on_worker_lost`: a killed worker's task goes back to the queue.

## Cron fallback (no Celery beat)

`scripts/daily_scrape.py` runs the same crawl without beat or workers. It uses the same lock
and the same run tables, so it is safe to have both: whichever starts first owns the day.

```cron
# host crontab, 02:00 Pakistan time = 21:00 UTC
0 21 * * *  cd /srv/leads && docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm worker-crawl python scripts/daily_scrape.py >> /var/log/leads-crawl.log 2>&1
# hourly: catch up if the nightly run was missed
20 * * * *  cd /srv/leads && docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm worker-crawl python scripts/daily_scrape.py --catchup >> /var/log/leads-crawl.log 2>&1
```

Exit codes: 0 success, 1 partial, 2 failed, 3 skipped (already ran, or no catch-up needed).

## Railway or Render

Same images, managed Postgres and Redis instead of the two containers:

| Platform service | Image | Start command |
|---|---|---|
| Pre-deploy / release command | `migrate.Dockerfile` | `npx prisma migrate deploy` |
| One-off job after first deploy | `worker.Dockerfile` | `python scripts/seed_config.py` |
| Worker (crawl) | `worker.Dockerfile` | `celery -A celery_app worker -Q crawl -c 2 --loglevel=info` |
| Worker (main) | `worker.Dockerfile` | `celery -A celery_app worker -Q default,intel,agents,messaging -c 2 --loglevel=info` |
| Beat, **1 instance, no autoscaling** | `worker.Dockerfile` | `celery -A celery_app beat --schedule /data/celerybeat-schedule --loglevel=info` (attach a small disk at `/data`) |
| Cron job (optional fallback) | `worker.Dockerfile` | `python scripts/daily_scrape.py`, schedule `0 21 * * *` UTC |

Set `DATABASE_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` to the managed services, plus
the variables from `.env.prod.example`. Do not run the crawl on serverless functions: a crawl
takes up to two hours.

## Web app

`--profile web` adds the Next.js app. Its image does not build yet: `next build` stops on a
type error in `app/api/admin/users/[id]/route.ts` (route params must be awaited in Next.js 16).
The scraping engine does not depend on it.
