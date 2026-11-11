from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from leads_scraper import parsing as p

NOW = datetime(2026, 11, 10, 21, 0, tzinfo=UTC)


@pytest.mark.parametrize("raw, expected", [
    ("1.85 Crore", 18_500_000),
    ("85 Lakh", 8_500_000),
    ("PKR 2.5 Crore", 25_000_000),
    ("Rs 1,50,000", 150_000),
    ("85 Lac", 8_500_000),
    ("24450000", 24_450_000),
    (24450000, 24_450_000),
    ("1 Arab", 1_000_000_000),
    ("", None),
    (None, None),
    ("0", None),
    (0, None),
    ("Call for price", None),
])
def test_parse_price(raw, expected):
    assert p.parse_price(raw) == expected


@pytest.mark.parametrize("raw, unit, value, canon, sqft", [
    ("5 Marla", None, "5", "marla", "1125.00"),
    ("1 Kanal", None, "1", "kanal", "4500.00"),
    ("1,250 Sq. Ft.", None, "1250", "sqft", "1250.00"),
    ("120 Sq. Yd.", None, "120", "sqyd", "1080.00"),
    (7, "marla", "7", "marla", "1575.00"),
    (4500, "sqfeet", "4500", "sqft", "4500.00"),
    (240, "sqyards", "240", "sqyd", "2160.00"),
    (2.4, "square feet", "2.4", "sqft", "2.40"),
    (209.03, "sqm", "209.03", "sqm", "2249.98"),
])
def test_parse_size_and_sqft(raw, unit, value, canon, sqft):
    num, u = p.parse_size(raw, unit)
    assert num == Decimal(value) and u == canon
    assert p.to_sqft(num, u) == Decimal(sqft)


def test_marla_factor_comes_from_config():
    assert p.to_sqft(Decimal(1), "marla", marla_sqft=272.25) == Decimal("272.25")


@pytest.mark.parametrize("raw", ["", None, "big plot", "0"])
def test_parse_size_missing(raw):
    assert p.parse_size(raw) == (None, None)


def test_relative_dates_are_estimated():
    assert p.parse_listed_at("3 hours ago", NOW) == (NOW - timedelta(hours=3), p.ESTIMATED, True)
    assert p.parse_listed_at("1 day ago", NOW) == (NOW - timedelta(days=1), p.ESTIMATED, True)
    assert p.parse_listed_at("an hour ago", NOW)[0] == NOW - timedelta(hours=1)


def test_iso_and_epoch_are_exact():
    dt, prec, ok = p.parse_listed_at("2026-06-19T11:42:41.008Z", NOW)
    assert dt == datetime(2026, 6, 19, 11, 42, 41, 8000, tzinfo=UTC) and prec == p.EXACT and ok
    dt, prec, _ = p.parse_listed_at("2026-07-13T05:49:32.9734791", NOW)  # Ilaan: 7 digits, no tz
    assert dt == datetime(2026, 7, 13, 5, 49, 32, 973479, tzinfo=UTC) and prec == p.EXACT
    dt, prec, _ = p.parse_listed_at(1794200595, NOW)
    assert dt == datetime.fromtimestamp(1794200595, tz=UTC) and prec == p.EXACT


@pytest.mark.parametrize("raw", [None, "", "sometime last spring"])
def test_unparseable_date_keeps_row_with_scraped_at(raw):
    assert p.parse_listed_at(raw, NOW) == (NOW, p.ESTIMATED, False)


def test_parse_int_zero_is_null_for_rooms():
    assert p.parse_int("0", zero_is_null=True) is None
    assert p.parse_int(3) == 3
    assert p.parse_int("4 beds") == 4
    assert p.parse_int(None) is None
