"""Pure parsers for portal values. No I/O; covered by tests/test_parsing.py."""

import re
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

_NUM = r"(\d+(?:[.,]\d+)*)"

# PKR multipliers for "as shown" price text.
_PRICE_UNITS = [
    (re.compile(r"\barab\b", re.I), 1_000_000_000),
    (re.compile(r"\b(crore|cr)\b", re.I), 10_000_000),
    (re.compile(r"\b(lakh|lac|lacs|lakhs)\b", re.I), 100_000),
    (re.compile(r"\b(thousand|k)\b", re.I), 1_000),
]

# Canonical size units, in the order they are tested.
_SIZE_UNITS = [
    ("kanal", re.compile(r"kanal", re.I)),
    ("marla", re.compile(r"marla", re.I)),
    ("sqyd", re.compile(r"sq(?:uare)?\.?\s*y(?:ar)?ds?|sqyards?|gaz", re.I)),
    ("sqm", re.compile(r"sq(?:uare)?\.?\s*m(?:eters?|etres?)?\b|sqm|m²", re.I)),
    ("sqft", re.compile(r"sq(?:uare)?\.?\s*f(?:ee)?t|sqfeet|sqft|ft²", re.I)),
]

SQFT_PER_SQYD = Decimal(9)
SQFT_PER_SQM = Decimal("10.7639")

_RELATIVE = re.compile(r"(\d+|an?|one)\s*(second|minute|min|hour|hr|day|week|month|year)s?\s*ago", re.I)
_REL_UNIT = {
    "second": timedelta(seconds=1), "minute": timedelta(minutes=1), "min": timedelta(minutes=1),
    "hour": timedelta(hours=1), "hr": timedelta(hours=1), "day": timedelta(days=1),
    "week": timedelta(weeks=1), "month": timedelta(days=30), "year": timedelta(days=365),
}

EXACT = "exact"
ESTIMATED = "estimated"


def _to_number(text: str) -> Decimal | None:
    m = re.search(_NUM, text)
    if not m:
        return None
    s = m.group(1)
    # "1,50,000" / "1,250" are thousands separators; "1.85" is a decimal.
    s = s.replace(",", "")
    try:
        return Decimal(s)
    except Exception:  # noqa: BLE001
        return None


def parse_price(value) -> int | None:
    """'1.85 Crore' -> 18500000, '85 Lakh' -> 8500000, 24450000 -> 24450000. None if absent or <= 0."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float, Decimal)):
        n = int(value)
        return n if n > 0 else None
    text = str(value).strip()
    if not text:
        return None
    num = _to_number(text)
    if num is None:
        return None
    for pattern, mult in _PRICE_UNITS:
        if pattern.search(text):
            num *= mult
            break
    n = int(num.to_integral_value(rounding=ROUND_HALF_UP))
    return n if n > 0 else None


def normalize_unit(unit: str | None) -> str | None:
    if not unit:
        return None
    for name, pattern in _SIZE_UNITS:
        if pattern.search(unit):
            return name
    return None


def parse_size(value, unit: str | None = None) -> tuple[Decimal | None, str | None]:
    """'5 Marla' -> (5, 'marla'); (7, 'sqfeet') -> (7, 'sqft'). Unit None if unknown."""
    if value is None or value == "":
        return None, None
    if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        num = Decimal(str(value))
        u = normalize_unit(unit)
    else:
        text = str(value)
        num = _to_number(text)
        u = normalize_unit(unit) or normalize_unit(text)
    if num is None or num <= 0:
        return None, None
    return num, u


def to_sqft(value: Decimal | None, unit: str | None, marla_sqft: float = 225.0,
            kanal_marla: float = 20.0) -> Decimal | None:
    if value is None or unit is None:
        return None
    marla = Decimal(str(marla_sqft))
    factor = {
        "sqft": Decimal(1),
        "marla": marla,
        "kanal": marla * Decimal(str(kanal_marla)),
        "sqyd": SQFT_PER_SQYD,
        "sqm": SQFT_PER_SQM,
    }.get(unit)
    if factor is None:
        return None
    return (Decimal(value) * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_listed_at(raw, scraped_at: datetime) -> tuple[datetime, str, bool]:
    """Return (listed_at, precision, parsed_ok).

    Epoch numbers and ISO strings are exact. Relative text ('3 hours ago') is estimated
    from scraped_at. Anything else falls back to scraped_at, estimated, parsed_ok=False,
    so the row is kept (SPEC_01 3.4).
    """
    if scraped_at.tzinfo is None:
        scraped_at = scraped_at.replace(tzinfo=UTC)
    if raw is None or raw == "" or isinstance(raw, bool):
        return scraped_at, ESTIMATED, False

    if isinstance(raw, (int, float)):
        ts = float(raw)
        if ts > 1e12:  # milliseconds
            ts /= 1000
        if ts > 0:
            return datetime.fromtimestamp(ts, tz=UTC), EXACT, True
        return scraped_at, ESTIMATED, False

    text = str(raw).strip()
    if re.fullmatch(r"\d{9,13}(\.\d+)?", text):
        return parse_listed_at(float(text), scraped_at)

    iso = _parse_iso(text)
    if iso is not None:
        return iso, EXACT, True

    low = text.lower()
    if low in ("just now", "now", "today"):
        return scraped_at, ESTIMATED, True
    if low == "yesterday":
        return scraped_at - timedelta(days=1), ESTIMATED, True
    m = _RELATIVE.search(text)
    if m:
        qty = m.group(1).lower()
        n = 1 if qty in ("a", "an", "one") else int(qty)
        return scraped_at - n * _REL_UNIT[m.group(2).lower()], ESTIMATED, True

    return scraped_at, ESTIMATED, False


def _parse_iso(text: str) -> datetime | None:
    t = text.replace("Z", "+00:00")
    # Python accepts at most 6 fractional digits; Ilaan sends 7.
    t = re.sub(r"(\.\d{6})\d+", r"\1", t)
    try:
        dt = datetime.fromisoformat(t)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)  # naive portal timestamps are treated as UTC
    return dt.astimezone(UTC)


def parse_int(value, zero_is_null: bool = False) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        n = int(value)
    else:
        m = re.search(r"\d+", str(value))
        if not m:
            return None
        n = int(m.group(0))
    if zero_is_null and n == 0:
        return None
    return n


def clean_text(value) -> str | None:
    if value is None:
        return None
    s = " ".join(str(value).split())
    return s or None


def to_bool(value) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in ("yes", "true", "1", "y"):
        return True
    if s in ("no", "false", "0", "n"):
        return False
    return None


def epoch_to_dt(value) -> datetime | None:
    if value in (None, "", 0):
        return None
    try:
        return datetime.fromtimestamp(float(value), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


def iso_to_dt(value) -> datetime | None:
    if not value:
        return None
    return _parse_iso(str(value))
