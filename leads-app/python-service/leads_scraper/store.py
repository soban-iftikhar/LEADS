"""Database writes for scraped listings (SPEC_01 section 4).

write_batch() runs one transaction per batch. For each record:
  1. if it has a phone: upsert app.contacts. The encrypted number lives only there;
     listings carry phone_hash and contact_id.
  2. upsert <portal>.listings on (platform, external_id); keep first_seen_at, bump
     last_seen_at, mark the ad active again
  3. if content_hash changed, append master.listing_events (PRICE_CHANGE or EDIT)
  4. if the master rules pass, upsert master.listings and intel.seller_contact_links
"""

import logging
from dataclasses import dataclass, field
from datetime import timedelta

from psycopg import sql
from psycopg.types.json import Jsonb

log = logging.getLogger(__name__)

COMMON = [
    "platform", "external_id", "url", "title", "category", "purpose",
    "price_raw", "price_pkr", "size_raw", "size_value", "size_unit", "size_sqft",
    "city", "locality", "location_text", "listed_at", "listed_at_precision", "scraped_at",
    "content_hash", "bedrooms", "bathrooms", "description", "amenities", "seller_name",
    "agency_name", "agency_profile_url", "is_agency", "phone_hash", "contact_id",
    "added_date_raw", "latitude", "longitude", "image_urls",
]

PORTAL_EXTRA = {
    "zameen": ["is_verified", "is_featured", "product", "agency_tier", "agency_since",
               "completion_status", "built_year", "floors"],
    "olx": ["is_verified", "is_featured", "product", "is_furnished", "floor_level", "portal_expires_at"],
    "graana": ["agency_since", "condition", "portal_expires_at"],
    "ilaan": ["is_verified", "is_featured", "is_gold_verified"],
}

# portal record key -> master column
MASTER_SHARED = ["is_verified", "is_featured", "portal_expires_at", "agency_since",
                 "built_year", "is_furnished", "floor_level"]
MASTER_PORTAL_SPECIFIC = {
    "zameen": {"product": "zameen_product", "agency_tier": "zameen_agency_tier",
               "completion_status": "zameen_completion_status", "floors": "zameen_floors"},
    "olx": {"product": "olx_product"},
    "graana": {"condition": "graana_condition"},
    "ilaan": {"is_gold_verified": "ilaan_is_gold_verified"},
}

# On update, a missing phone (e.g. expired token) must not wipe the one we have.
KEEP_IF_NULL = {"phone_hash", "contact_id"}


@dataclass
class BatchResult:
    new: int = 0
    updated: int = 0
    events: int = 0
    master: int = 0
    rejected: int = 0
    contacts: int = 0
    failed: list = field(default_factory=list)


def _upsert_sql(schema: str, cols: list[str], extra_insert: dict[str, str], returning: sql.Composable):
    table = sql.Identifier(schema, "listings")
    insert_cols = cols + list(extra_insert)
    values = [sql.Placeholder(c) for c in cols] + [sql.SQL(v) for v in extra_insert.values()]
    updates = []
    for c in cols:
        if c in ("platform", "external_id"):
            continue
        if c in KEEP_IF_NULL:
            updates.append(sql.SQL("{c} = COALESCE(EXCLUDED.{c}, {t}.{c})").format(c=sql.Identifier(c), t=table))
        else:
            updates.append(sql.SQL("{c} = EXCLUDED.{c}").format(c=sql.Identifier(c)))
    updates.append(sql.SQL("last_seen_at = EXCLUDED.scraped_at"))
    # Seen again on the portal: it is live, whatever the presence sweep said before.
    updates.append(sql.SQL("status = 'active', exited_at = NULL, last_checked_at = EXCLUDED.scraped_at"))
    return sql.SQL(
        "INSERT INTO {t} ({cols}) VALUES ({vals}) "
        "ON CONFLICT (platform, external_id) DO UPDATE SET {upd} RETURNING {ret}"
    ).format(
        t=table,
        cols=sql.SQL(", ").join(map(sql.Identifier, insert_cols)),
        vals=sql.SQL(", ").join(values),
        upd=sql.SQL(", ").join(updates),
        ret=returning,
    )


_PORTAL_SQL: dict[str, sql.Composable] = {}
_MASTER_SQL: dict[str, sql.Composable] = {}


def portal_sql(platform: str) -> sql.Composable:
    if platform not in _PORTAL_SQL:
        cols = COMMON + PORTAL_EXTRA[platform] + ["raw", "master_rejected_reason"]
        table = sql.Identifier(platform, "listings")
        prev = sql.SQL(
            "WITH prev AS (SELECT content_hash, price_pkr, size_sqft, title FROM {t} "
            "WHERE platform = %(platform)s AND external_id = %(external_id)s) "
        ).format(t=table)
        returning = sql.SQL(
            "id, (xmax = 0) AS inserted, (SELECT content_hash FROM prev), "
            "(SELECT price_pkr FROM prev), (SELECT size_sqft FROM prev), (SELECT title FROM prev)"
        )
        extra = {"first_seen_at": "%(scraped_at)s", "last_seen_at": "%(scraped_at)s",
                 "last_checked_at": "%(scraped_at)s"}
        _PORTAL_SQL[platform] = prev + _upsert_sql(platform, cols, extra, returning)
    return _PORTAL_SQL[platform]


def master_columns(platform: str) -> dict[str, str]:
    """record key -> master column, for one portal."""
    out = {c: c for c in COMMON}
    out.update({c: c for c in MASTER_SHARED if c in PORTAL_EXTRA[platform]})
    out.update(MASTER_PORTAL_SPECIFIC[platform])
    return out


def master_sql(platform: str) -> sql.Composable:
    if platform not in _MASTER_SQL:
        cols = list(master_columns(platform).values()) + ["source_row_id", "source_schema"]
        extra = {"first_seen_at": "%(scraped_at)s", "last_seen_at": "%(scraped_at)s",
                 "last_checked_at": "%(scraped_at)s"}
        _MASTER_SQL[platform] = _upsert_sql("master", cols, extra, sql.SQL("id"))
    return _MASTER_SQL[platform]


EVENT_SQL = (
    "INSERT INTO master.listing_events (platform, listing_id, type, old, new, at) "
    "VALUES (%s, %s, %s, %s, %s, %s)"
)

CONTACT_SQL = """
INSERT INTO app.contacts (phone_hash, phone_enc, name, first_source, purge_at)
VALUES (%(phone_hash)s, %(phone_enc)s, %(name)s, 'PORTAL_SELLER', %(purge_at)s)
ON CONFLICT (phone_hash) DO UPDATE SET
  phone_enc = COALESCE(app.contacts.phone_enc, EXCLUDED.phone_enc),
  name      = COALESCE(app.contacts.name, EXCLUDED.name),
  -- NULL means the contact became a lead or user: never schedule it for purge again
  purge_at  = CASE WHEN app.contacts.purge_at IS NULL THEN NULL
                   ELSE GREATEST(app.contacts.purge_at, EXCLUDED.purge_at) END
RETURNING id
"""

LINK_SQL = """
INSERT INTO intel.seller_contact_links (contact_id, master_listing_id) VALUES (%s, %s)
ON CONFLICT DO NOTHING
"""


def _params(rec: dict, keys: list[str]) -> dict:
    out = {k: rec.get(k) for k in keys}
    if "raw" in out:
        out["raw"] = Jsonb(out["raw"])
    return out


def _snapshot(price, size, title) -> dict:
    return {"price_pkr": None if price is None else str(price),
            "size_sqft": None if size is None else str(size), "title": title}


def write_record(cur, rec: dict, result: BatchResult, purge_days: int) -> None:
    platform = rec["platform"]

    # 1. contact first, so both listing rows can point at it
    rec["contact_id"] = None
    if rec.get("phone_hash"):
        cur.execute(CONTACT_SQL, {
            "phone_hash": rec["phone_hash"], "phone_enc": rec.get("phone_enc"),
            "name": rec.get("seller_name"),
            "purge_at": rec["scraped_at"] + timedelta(days=purge_days),
        })
        rec["contact_id"] = cur.fetchone()[0]
        result.contacts += 1

    # 2. portal row
    keys = COMMON + PORTAL_EXTRA[platform] + ["raw", "master_rejected_reason"]
    cur.execute(portal_sql(platform), _params(rec, keys))
    row_id, inserted, prev_hash, prev_price, prev_size, prev_title = cur.fetchone()
    if inserted:
        result.new += 1
    else:
        result.updated += 1
        # 3. change event
        if prev_hash != rec["content_hash"]:
            kind = "PRICE_CHANGE" if prev_price != rec.get("price_pkr") else "EDIT"
            cur.execute(EVENT_SQL, (
                platform, row_id, kind,
                Jsonb(_snapshot(prev_price, prev_size, prev_title)),
                Jsonb(_snapshot(rec.get("price_pkr"), rec.get("size_sqft"), rec.get("title"))),
                rec["scraped_at"],
            ))
            result.events += 1

    if rec.get("master_rejected_reason"):
        result.rejected += 1
        return

    # 4. master row and buyer-pool link
    mparams = {mcol: rec.get(key) for key, mcol in master_columns(platform).items()}
    mparams.update(source_row_id=row_id, source_schema=platform)
    cur.execute(master_sql(platform), mparams)
    master_id = cur.fetchone()[0]
    result.master += 1
    if rec["contact_id"]:
        cur.execute(LINK_SQL, (rec["contact_id"], master_id))


def write_batch(pool, records: list[dict], purge_days: int = 60) -> BatchResult:
    """Write records in one transaction. If it fails, retry each row alone so one bad
    row cannot lose the other 99."""
    result = BatchResult()
    if not records:
        return result
    try:
        with pool.connection() as conn, conn.transaction(), conn.cursor() as cur:
            for rec in records:
                write_record(cur, rec, result, purge_days)
        return result
    except Exception as e:  # noqa: BLE001
        log.warning("batch of %d failed (%s); retrying row by row", len(records), e)

    result = BatchResult()
    for rec in records:
        try:
            with pool.connection() as conn, conn.transaction(), conn.cursor() as cur:
                write_record(cur, rec, result, purge_days)
        except Exception as e:  # noqa: BLE001
            log.error("write failed for %s/%s: %s", rec.get("platform"), rec.get("external_id"), e)
            result.failed.append((rec.get("platform"), rec.get("external_id"), str(e)))
    return result
