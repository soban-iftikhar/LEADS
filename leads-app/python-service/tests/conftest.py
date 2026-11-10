import base64
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Fixed keys for tests only. Set before leads.settings is imported anywhere.
TEST_PEPPER = base64.b64encode(bytes(range(32))).decode()
TEST_ENC_KEY = base64.b64encode(bytes(range(32, 64))).decode()
os.environ["PHONE_HASH_PEPPER"] = TEST_PEPPER
os.environ["PHONE_ENC_KEY"] = TEST_ENC_KEY
os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql://leads_user:leads_password@localhost:5432/leads_test"
)

FIXTURES = ROOT / "tests" / "fixtures"
PORTALS = ["zameen", "olx", "graana", "ilaan"]
SCRAPED_AT = datetime(2026, 11, 10, 21, 0, tzinfo=timezone.utc)


def load_fixtures(portal: str) -> list[tuple[str, dict]]:
    return [(f.stem, json.loads(f.read_text())) for f in sorted((FIXTURES / portal).glob("*.json"))]


def ctx_for(portal: str, payload: dict, scraped_at=SCRAPED_AT) -> dict:
    return {"scraped_at": scraped_at, "category": "house", "purpose": "sale",
            "city": None, "url": payload.get("source_url") if portal != "ilaan" else None}


@pytest.fixture(scope="session")
def settings():
    from leads.settings import get_settings
    return get_settings()


@pytest.fixture
def spider():
    return SimpleNamespace(records_rejected=0, errors=[], logger=logging.getLogger("test-spider"))


TRUNCATE = """
TRUNCATE zameen.listings, olx.listings, graana.listings, ilaan.listings,
         master.listings, master.listing_events, master.crawl_run_portals, master.crawl_runs,
         intel.seller_contact_links, app.contacts CASCADE
"""


@pytest.fixture
def db():
    """Connection pool on the test database, emptied before each test."""
    from leads.db import get_pool
    try:
        pool = get_pool()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"test database unavailable: {e}")
    with pool.connection() as conn:
        conn.execute(TRUNCATE)
    yield pool


def pytest_sessionfinish(session, exitstatus):
    from leads.db import close_pool
    close_pool()
