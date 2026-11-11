"""Celery application: queues, routing, reliability settings and the beat schedule.

Run (from this directory):
    celery -A celery_app worker -Q crawl -c 2 --loglevel=info                       # spiders
    celery -A celery_app worker -Q default,intel,agents,messaging -c 4 --loglevel=info
    celery -A celery_app beat --schedule /data/celerybeat-schedule --loglevel=info  # exactly one
"""

from celery import Celery
from celery.schedules import crontab
from kombu import Queue

from leads.settings import get_settings

# All configuration comes from leads.settings (one validated source for every process).
settings = get_settings()

# A crawl task may run 2.5 h. Redis re-delivers any task not acknowledged within the
# visibility timeout, so it must be longer than the longest task or crawls start twice.
VISIBILITY_TIMEOUT = 4 * 3600

app = Celery(
    "leads",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["leads.crawl.tasks", "leads.jobs.tasks", "leads.ops.tasks"],
)

app.conf.update(
    timezone=settings.celery_timezone,
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
        "schedule": crontab(hour=settings.daily_scrape_hour, minute=settings.daily_scrape_minute),
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
