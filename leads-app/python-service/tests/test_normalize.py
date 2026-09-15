import json
import re

import pytest

from leads.redact import PHONE_RE
from leads_scraper.normalize import master_rejection, normalize
from leads_scraper.pipelines import CleaningPipeline
from tests.conftest import PORTALS, ctx_for, load_fixtures

ALL = [(portal, name, payload) for portal in PORTALS for name, payload in load_fixtures(portal)]


@pytest.mark.parametrize("portal, name, payload", ALL, ids=[f"{a}-{b}" for a, b, _ in ALL])
def test_fixture_normalizes_to_full_record(portal, name, payload, settings):
    rec = normalize(portal, payload, ctx_for(portal, payload), settings)
    assert rec["platform"] == portal
    assert rec["external_id"] == name
    for key in ("title", "category", "purpose", "city", "listed_at", "listed_at_precision",
                "scraped_at", "content_hash", "raw"):
        assert rec[key] not in (None, ""), key
    assert rec["purpose"] in ("sale", "rent")
    assert rec["listed_at_precision"] in ("exact", "estimated")
    if rec["size_unit"] is not None:
        assert rec["size_sqft"] > 0


@pytest.mark.parametrize("portal, name, payload", ALL, ids=[f"{a}-{b}" for a, b, _ in ALL])
def test_raw_has_no_phone_numbers(portal, name, payload, settings):
    rec = normalize(portal, payload, ctx_for(portal, payload), settings)
    text = json.dumps(rec["raw"])
    assert not PHONE_RE.search(text)
    assert not re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)


def test_exact_dates_for_zameen_olx_graana_estimated_for_ilaan(settings):
    for portal, expected in [("zameen", "exact"), ("olx", "exact"), ("graana", "exact"), ("ilaan", "estimated")]:
        for _, payload in load_fixtures(portal):
            assert normalize(portal, payload, ctx_for(portal, payload), settings)["listed_at_precision"] == expected


def test_plots_have_null_bedrooms(settings):
    plots = [
        normalize(portal, payload, ctx_for(portal, payload), settings)
        for portal in PORTALS for _, payload in load_fixtures(portal)
    ]
    plots = [r for r in plots if r["category"] in ("residential_plot", "commercial_plot")]
    assert plots, "fixtures should include at least one plot"
    assert all(r["bedrooms"] is None for r in plots)


def test_missing_price_and_date_keep_the_row(settings, spider):
    _, payload = load_fixtures("graana")[0]
    payload = json.loads(json.dumps(payload))
    payload["detail"]["price"] = None
    payload["detail"]["createdAt"] = None
    item = {"platform": "graana", "payload": payload, "ctx": ctx_for("graana", payload)}
    rec = CleaningPipeline().process_item(item, spider)
    assert rec["price_pkr"] is None
    assert rec["listed_at"] == rec["scraped_at"] and rec["listed_at_precision"] == "estimated"
    assert "price_pkr" in rec["master_rejected_reason"]


def test_cleaning_replaces_phone_with_hash_and_ciphertext(settings, spider):
    _, payload = load_fixtures("zameen")[0]
    item = {"platform": "zameen", "payload": payload, "ctx": ctx_for("zameen", payload)}
    rec = CleaningPipeline().process_item(item, spider)
    assert "_phone" not in rec
    assert len(rec["phone_hash"]) == 64 and rec["phone_enc"]


def test_master_rules():
    good = {"price_pkr": 1, "size_sqft": 1, "city": "Islamabad", "locality": "F-10",
            "category": "house", "url": "https://x"}
    assert master_rejection(good) is None
    assert "locality" in master_rejection({**good, "locality": None})
    assert "url" in master_rejection({**good, "url": None})
    assert "category" in master_rejection({**good, "category": "castle"})
