import re
from datetime import datetime, timezone, timedelta

RELATIVE_DATE_RE = re.compile(
    r"(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago", re.IGNORECASE
)


def parse_listed_at(raw: str, scraped_at: datetime = None):
    
    """
    Graana/Ilaan give real ISO timestamps — used directly.
    Zameen/OLX give relative text ("7 minutes ago") — converted into an
    absolute estimate using scraped_at as the reference point.
    Returns None if the format isn't recognized.
    """

    if not raw:
        return None
    raw = raw.strip()
    scraped_at = scraped_at or datetime.now(timezone.utc)

    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        pass

    match = RELATIVE_DATE_RE.search(raw)
    if not match:
        return None

    amount, unit = int(match.group(1)), match.group(2).lower()
    unit_map = {
        "minute": timedelta(minutes=amount),
        "hour": timedelta(hours=amount),
        "day": timedelta(days=amount),
        "week": timedelta(weeks=amount),
        "month": timedelta(days=amount * 30),
        "year": timedelta(days=amount * 365),
    }
    return scraped_at - unit_map[unit]