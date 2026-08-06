import os

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv()

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/1")

app = Celery("leads_scraper", broker=BROKER_URL, backend=RESULT_BACKEND, include=["tasks"])

app.conf.update(
    task_track_started=True,
    task_acks_late=True,
    # One crawl fully occupies a worker slot; never buffer extra crawls on a busy worker.
    worker_prefetch_multiplier=1,
    result_expires=86400,
    timezone=os.getenv("CELERY_TIMEZONE", "Asia/Karachi"),
    enable_utc=True,
)

# Fires daily_refresh once every 24h. Hour/minute overridable via env for staging.
app.conf.beat_schedule = {
    "daily-fresh-scrape": {
        "task": "tasks.daily_refresh",
        "schedule": crontab(
            hour=int(os.getenv("DAILY_SCRAPE_HOUR", "3")),
            minute=int(os.getenv("DAILY_SCRAPE_MINUTE", "0")),
        ),
    }
}
