"""psycopg 3 connection pool shared by pipelines and tasks."""

from psycopg_pool import ConnectionPool

from leads.settings import get_settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        s = get_settings()
        pool = ConnectionPool(s.database_url, min_size=s.db_pool_min, max_size=s.db_pool_max,
                              open=True, name="leads")
        try:
            pool.wait(timeout=30)
        except Exception:
            # Without this, the next caller would get a pool that can never connect.
            pool.close()
            raise
        _pool = pool
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
