import copy
from datetime import timedelta

from leads.crypto import normalize_phone
from leads_scraper.pipelines import CleaningPipeline
from leads_scraper.store import write_batch
from tests.conftest import PORTALS, SCRAPED_AT, ctx_for, load_fixtures


def records(portal, spider, scraped_at=SCRAPED_AT, mutate=None):
    out = []
    for _, payload in load_fixtures(portal):
        payload = copy.deepcopy(payload)
        if mutate:
            mutate(payload)
        item = {"platform": portal, "payload": payload, "ctx": ctx_for(portal, payload, scraped_at)}
        out.append(CleaningPipeline().process_item(item, spider))
    return out


def count(pool, table, where="true", params=()):
    with pool.connection() as conn:
        return conn.execute(f"SELECT count(*) FROM {table} WHERE {where}", params).fetchone()[0]


def test_same_fixture_twice_no_duplicates_and_seen_times(db, spider):
    first = write_batch(db, records("zameen", spider))
    assert first.new == 3 and first.updated == 0

    later = SCRAPED_AT + timedelta(hours=24)
    second = write_batch(db, records("zameen", spider, scraped_at=later))
    assert second.new == 0 and second.updated == 3 and second.events == 0

    assert count(db, "zameen.listings") == 3
    assert count(db, "master.listings", "platform = 'zameen'") == 3
    with db.connection() as conn:
        rows = conn.execute("SELECT first_seen_at, last_seen_at FROM zameen.listings").fetchall()
        mrows = conn.execute("SELECT first_seen_at, last_seen_at FROM master.listings").fetchall()
    assert all(f == SCRAPED_AT and last == later for f, last in rows + mrows)


def test_price_change_writes_event(db, spider):
    write_batch(db, records("olx", spider))

    def bump(payload):
        payload["detail"]["extraFields"]["price"] = payload["detail"]["extraFields"]["price"] + 100_000

    res = write_batch(db, records("olx", spider, SCRAPED_AT + timedelta(hours=1), bump))
    assert res.events == 3
    assert count(db, "master.listing_events", "platform = 'olx' AND type = 'PRICE_CHANGE'") == 3


def test_row_without_price_stays_in_portal_table_with_reason(db, spider):
    def no_price(payload):
        payload["detail"]["price"] = None

    res = write_batch(db, records("graana", spider, mutate=no_price))
    assert res.new == 3 and res.master == 0 and res.rejected == 3
    assert count(db, "graana.listings", "price_pkr IS NULL AND master_rejected_reason LIKE %s", ("%price_pkr%",)) == 3
    assert count(db, "master.listings", "platform = 'graana'") == 0


def test_all_portals_write_and_link_contacts(db, spider):
    for portal in PORTALS:
        res = write_batch(db, records(portal, spider))
        assert not res.failed, res.failed
    # Every Ilaan row gets a built URL; rows with a locality reach master, the rest say why not.
    assert count(db, "ilaan.listings", "url LIKE %s", ("https://www.ilaan.com/%-pid%",)) == 3
    in_master = count(db, "master.listings", "platform = 'ilaan'")
    no_locality = count(db, "ilaan.listings", "master_rejected_reason LIKE %s", ("%locality%",))
    assert in_master + no_locality == 3 and in_master >= 1
    assert count(db, "app.contacts") >= 1
    assert count(db, "intel.seller_contact_links") >= 1
    assert count(db, "app.contacts", "purge_at IS NULL") == 0


def _phone_values(obj, key=""):
    from leads.redact import PHONE_KEY_RE
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _phone_values(v, k)
    elif isinstance(obj, list):
        for v in obj:
            yield from _phone_values(v, key)
    elif isinstance(obj, (str, int)) and PHONE_KEY_RE.search(key):
        yield obj


def test_no_plaintext_phone_anywhere(db, spider):
    import re

    from leads_scraper.normalize import normalize
    from tests.conftest import load_fixtures as lf

    plain = set()
    for portal in PORTALS:
        write_batch(db, records(portal, spider))
        for _, payload in lf(portal):
            values = list(_phone_values(payload))
            values.append(normalize(portal, payload, ctx_for(portal, payload), spider_settings())["_phone"])
            for v in values:
                n = normalize_phone(v)
                if n:
                    plain.update({n, n[1:], "+92" + n[1:], "92" + n[1:]})
    assert plain
    tables = ["zameen.listings", "olx.listings", "graana.listings", "ilaan.listings",
              "master.listings", "app.contacts", "master.listing_events"]
    with db.connection() as conn:
        for t in tables:
            dump = " ".join(r[0] for r in conn.execute(f"SELECT t::text FROM {t} t").fetchall())
            leaked = [n for n in plain if re.search(rf"(?<![0-9A-Za-z]){re.escape(n)}(?![0-9A-Za-z])", dump)]
            assert not leaked, f"{t} contains plaintext phone(s)"


def spider_settings():
    from leads.settings import get_settings
    return get_settings()


def test_phone_ciphertext_lives_only_in_contacts(db, spider):
    for portal in PORTALS:
        write_batch(db, records(portal, spider))
    with db.connection() as conn:
        cols = conn.execute(
            "SELECT table_schema FROM information_schema.columns "
            "WHERE column_name = 'phone_enc' AND table_name = 'listings'").fetchall()
        assert cols == []
        # every listing with a phone points at a contact that holds the ciphertext
        for t in ["zameen.listings", "olx.listings", "graana.listings", "master.listings"]:
            orphans = conn.execute(
                f"SELECT count(*) FROM {t} l LEFT JOIN app.contacts c ON c.id = l.contact_id "
                f"WHERE l.phone_hash IS NOT NULL AND (c.id IS NULL OR c.phone_enc IS NULL "
                f"OR c.phone_hash <> l.phone_hash)").fetchone()[0]
            assert orphans == 0, t


def test_portal_only_rows_still_get_a_contact(db, spider):
    def no_price(payload):
        payload["detail"]["price"] = None

    res = write_batch(db, records("graana", spider, mutate=no_price))
    assert res.master == 0 and res.contacts == 3
    assert count(db, "graana.listings", "contact_id IS NOT NULL") == 3


def test_seen_again_reactivates_exited_listing(db, spider):
    write_batch(db, records("zameen", spider))
    with db.connection() as conn:
        conn.execute("UPDATE zameen.listings SET status = 'exited', exited_at = now()")
        conn.execute("UPDATE master.listings SET status = 'exited', exited_at = now()")
    write_batch(db, records("zameen", spider, SCRAPED_AT + timedelta(hours=24)))
    assert count(db, "zameen.listings", "status = 'active' AND exited_at IS NULL") == 3
    assert count(db, "master.listings", "status = 'active' AND exited_at IS NULL") == 3


def test_missing_phone_on_update_keeps_existing_hash(db, spider):
    write_batch(db, records("zameen", spider))

    def drop_phones(payload):
        payload["detail"]["phoneNumber"] = None
        payload["detail"]["mobilePhoneNumber"] = None

    write_batch(db, records("zameen", spider, SCRAPED_AT + timedelta(hours=1), drop_phones))
    assert count(db, "zameen.listings", "phone_hash IS NULL OR contact_id IS NULL") == 0
