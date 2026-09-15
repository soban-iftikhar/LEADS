"""Active cities per portal, read from the config tables (no hardcoded cities)."""

from leads.db import get_pool

SQL = """
SELECT r.name, m.external_city_id, p.requests_per_minute
FROM config.portal_region_maps m
JOIN config.portals p ON p.id = m.portal_id
JOIN config.regions r ON r.id = m.region_id
WHERE p.slug = %s AND p.active AND r.active AND m.active
ORDER BY r.name
"""


def active_cities(platform: str, only: str | None = None) -> list[tuple[str, str]]:
    """[(city name, portal's external city id)], optionally filtered to one city name."""
    with get_pool().connection() as conn:
        rows = conn.execute(SQL, (platform,)).fetchall()
    cities = [(name, ext) for name, ext, _ in rows]
    if only:
        cities = [c for c in cities if c[0].lower() == only.lower()]
    return cities


def requests_per_minute(platform: str, default: int = 15) -> int:
    with get_pool().connection() as conn:
        row = conn.execute("SELECT requests_per_minute FROM config.portals WHERE slug = %s", (platform,)).fetchone()
    return row[0] if row else default
