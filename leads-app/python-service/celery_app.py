"""Celery application: queues, routing, reliability settings and the beat schedule.

Run (from this directory):
    celery -A celery_app worker -Q crawl -c 2 --loglevel=info                       # spiders
    celery -A celery_app worker -Q default,intel,agents,messaging -c 4 --loglevel=info
    celery -A celery_app beat --schedule /data/celerybeat-schedule --loglevel=info  # exactly one
"""

import os

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv
from kombu import Queue

load_dotenv(".env.local")
load_dotenv()

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/1")
TIMEZONE = os.getenv("CELERY_TIMEZONE", "Asia/Karachi")

DAILY_SCRAPE_HOUR = int(os.getenv("DAILY_SCRAPE_HOUR", "2"))
DAILY_SCRAPE_MINUTE = int(os.getenv("DAILY_SCRAPE_MINUTE", "0"))

# A crawl task may run 2.5 h. Redis re-delivers any task not acknowledged within the
# visibility timeout, so it must be longer than the longest task or crawls start twice.
VISIBILITY_TIMEOUT = 4 * 3600

app = Celery("leads", broker=BROKER_URL, backend=RESULT_BACKEND, include=["tasks"])

app.conf.update(
    timezone=TIMEZONE,
    enable_utc=True,  # stored and compared in UTC; beat converts the 02:00 PKT schedule
    task_queues=[Queue(name) for name in ("default", "crawl", "intel", "agents", "messaging")],
    task_default_queue="default",
    task_routes={"crawl.run_portal": {"queue": "crawl"}},
    # reliability
    task_acks_late=True,                # a task is only done once it returns
    task_reject_on_worker_lost=True,    # a killed worker's task goes back to the queue
    worker_prefetch_multiplier=1,       # never hold extra crawls on a busy worker
    task_track_started=True,
    broker_transport_options={"visibility_timeout": VISIBILITY_TIMEOUT},
    result_backend_transport_options={"visibility_timeout": VISIBILITY_TIMEOUT},
    broker_connection_retry_on_startup=True,
    result_expires=86400,
    worker_max_tasks_per_child=20,      # recycle worker processes; keeps memory flat
)

app.conf.beat_schedule = {
    "crawl-daily-refresh": {
        "task": "crawl.daily_refresh",
        "schedule": crontab(hour=DAILY_SCRAPE_HOUR, minute=DAILY_SCRAPE_MINUTE),
    },
    "crawl-catchup-check": {
        "task": "crawl.catchup_check",
        "schedule": crontab(minute=20),  # hourly, off the top of the hour
    },
    "jobs-dispatch-requests": {
        "task": "jobs.dispatch_requests",
        "schedule": 10.0,
    },
    "ops-heartbeat": {
        "task": "ops.heartbeat",
        "schedule": 60.0,
    },
}
