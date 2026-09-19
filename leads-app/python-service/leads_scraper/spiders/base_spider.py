import os
from datetime import datetime, timedelta, timezone

import scrapy

from leads_scraper.items import RawListingItem
from leads_scraper.parsing import parse_listed_at


def _to_int(value):
    if value in (None, "", "None"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class BaseSpider(scrapy.Spider):
    """Base class for all LEADS portal spiders.

    Spiders only fetch and yield RawListingItem (the portal's own JSON plus context).
    Parsing, phone protection and storage happen in the item pipelines.
    """

    platform_name = None
    CATEGORY_MAP = {}  # canonical -> platform-specific value, set by child

    def __init__(
        self,
        city=None,
        category=None,
        purpose=None,
        since_hours=None,
        full_scrape=False,
        max_records=None,
        run_id=None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.city = city or None
        self.category = category or None
        self.purpose = purpose or None  # "sale" / "rent" — None = both
        self.since_hours = _to_int(since_hours)
        self.full_scrape = str(full_scrape).lower() == "true"
        self.max_records = _to_int(max_records)
        self.run_id = run_id or None  # master.crawl_runs.id when started by the scheduler
        # Window: keep only listings newer than `since_hours` (SPEC_01 5.1). Pages per segment
        # are capped so a portal with no usable date order cannot run forever.
        self.started_at = datetime.now(timezone.utc)
        self.cutoff = (self.started_at - timedelta(hours=self.since_hours)) if self.since_hours else None
        if self.cutoff:
            self.max_pages = int(os.getenv("DAILY_MAX_PAGES", "15"))
        else:
            self.max_pages = 999 if self.full_scrape else 3
        self.skipped_old = 0

        # Written by the pipelines.
        self.records_collected = 0
        self.records_rejected = 0
        self.items_new = 0
        self.items_updated = 0

        # Owned by the spider.
        self.dispatched = 0
        self.pages_fetched = 0
        self.errors = []
        self.auth_failed = False  # set when a portal token is rejected; run ends `partial`

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super().from_crawler(crawler, *args, **kwargs)
        # Pace per portal comes from config.portals.requests_per_minute.
        try:
            from leads_scraper.regions import requests_per_minute
            rpm = max(1, requests_per_minute(spider.platform_name))
            spider.download_delay = 60.0 / rpm
        except Exception as e:  # noqa: BLE001 - keep the project default if config is unreachable
            spider.logger.warning(f"[{spider.platform_name}] could not read pace from config: {e}")
        return spider

    def cities(self) -> list[tuple[str, str]]:
        """Active (city name, portal city id) pairs from config, filtered by -a city=."""
        from leads_scraper.regions import active_cities
        found = active_cities(self.platform_name, self.city)
        if not found:
            self.logger.error(f"[{self.platform_name}] no active cities in config"
                              + (f" matching {self.city!r}" if self.city else ""))
        return found

    # Category mapping

    def platform_category(self, canonical: str):
        """Maps a canonical category to this platform's own value, or None if unsupported."""
        return self.CATEGORY_MAP.get(canonical)

    # Dispatch cap

    def should_dispatch(self) -> bool:
        if self.max_records is None:
            return True
        if self.records_collected >= self.max_records:
            return False
        return self.dispatched < self.max_records * 10

    # Window

    def is_fresh(self, raw_date) -> bool:
        """True if the listing is inside the crawl window. Unknown dates are kept."""
        if self.cutoff is None or raw_date in (None, ""):
            return True
        listed, _, ok = parse_listed_at(raw_date, self.started_at)
        if not ok:
            return True
        if listed < self.cutoff:
            self.skipped_old += 1
            return False
        return True

    def keep_paging(self, fresh_on_page: int, page: int) -> bool:
        """Next page only while this one still had something inside the window."""
        if not self.should_dispatch() or page >= self.max_pages:
            return False
        return self.cutoff is None or fresh_on_page > 0

    # Items

    def raw_item(self, payload: dict, *, category, purpose, city=None, url=None) -> RawListingItem:
        return RawListingItem(
            platform=self.platform_name,
            payload=payload,
            ctx={
                "scraped_at": datetime.now(timezone.utc),
                "category": category,
                "purpose": purpose,
                "city": city,
                "url": url,
            },
        )

    # Errors

    def handle_error(self, failure):
        url = failure.request.url
        msg = str(failure.value)
        self.logger.error(f"[{self.platform_name}] Request failed: {url} — {msg}")
        self.errors.append({"url": url, "error": msg})

    def blocked_reason(self) -> str | None:
        """Why this run is degraded, for master.crawl_run_portals.error."""
        if self.auth_failed:
            return "token expired: login refused, listings saved without phone numbers"
        if self.pages_fetched == 0 and self.errors:
            return f"no listing page could be fetched ({len(self.errors)} errors, e.g. {self.errors[0].get('error', '')[:160]})"
        if len(self.errors) > max(self.records_collected, 10):
            # the portal answered, but refused most detail pages (blocked or challenged)
            return f"mostly blocked: {len(self.errors)} requests failed, {self.records_collected} listings saved"
        return None

    def closed(self, reason):
        self.logger.info(
            f"[{self.platform_name}] finished ({reason}): collected={self.records_collected} "
            f"new={self.items_new} updated={self.items_updated} rejected={self.records_rejected} "
            f"old_skipped={self.skipped_old} pages={self.pages_fetched} errors={len(self.errors)} "
            f"auth_failed={self.auth_failed}"
        )
        if self.run_id:
            self._record_run()

    def _record_run(self):
        """Write this portal's result to master.crawl_run_portals (SPEC_01 3.6)."""
        from leads.db import close_pool, get_pool
        error = self.blocked_reason()
        status = "failed" if (self.pages_fetched == 0 and self.errors) else "success"
        try:
            with get_pool().connection() as conn:
                conn.execute(
                    """UPDATE master.crawl_run_portals
                       SET finished_at = now(), pages_fetched = %s, items_seen = %s, items_new = %s,
                           items_updated = %s, items_rejected = %s, errors = %s, status = %s, error = %s
                       WHERE run_id = %s AND platform = %s""",
                    (self.pages_fetched, self.records_collected, self.items_new, self.items_updated,
                     self.records_rejected, len(self.errors), status, error, self.run_id, self.platform_name),
                )
        except Exception as e:  # noqa: BLE001 - the scheduler marks the portal failed if this row stays `running`
            self.logger.error(f"[{self.platform_name}] could not record run stats: {e}")
        finally:
            close_pool()
