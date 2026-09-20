# Python workers and beat (Celery + Scrapy). Build context: leads-app/python-service
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CRAWL_LOG_DIR=/app/logs

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# /data holds the beat schedule file; /app/logs holds one log per spider run.
RUN useradd --create-home --uid 10001 app \
    && mkdir -p /data /app/logs \
    && chown -R app:app /data /app
USER app

# tini reaps the spider child processes and forwards SIGTERM for a clean shutdown.
ENTRYPOINT ["tini", "--"]
CMD ["celery", "-A", "celery_app", "worker", "-Q", "crawl", "-c", "2", "--loglevel=info"]
