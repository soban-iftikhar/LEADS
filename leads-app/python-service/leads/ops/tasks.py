"""Liveness signal for monitoring: proves beat and at least one worker are running."""

import socket

from psycopg.types.json import Jsonb

from celery_app import app
from leads.db import get_pool


@app.task(name="ops.heartbeat")
def heartbeat():
    with get_pool().connection() as conn:
        conn.execute(
            """INSERT INTO ops.heartbeats (service, beat_at, meta) VALUES ('beat', now(), %s)
               ON CONFLICT (service) DO UPDATE SET beat_at = now(), meta = EXCLUDED.meta""",
            (Jsonb({"worker": socket.gethostname()}),))
