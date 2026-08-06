import os
import scrapy
from leads_scraper.items import PropertyItem


def _to_int(value):
    if value in (None, "", "None"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class BaseSpider(scrapy.Spider):
    """
    Base class for all LEADS platform scrapers.
    """

    platform_name = None
    CATEGORY_MAP = {}  # canonical -> platform-specific value, set by child

    def __init__(
        self,
        city=None,
        category=None,
        price_min=None,
        price_max=None,
        purpose=None,
        since_hours=None, 
        full_scrape=False,
        max_records=None,
        job_id=None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)

        self.city = city or None
        self.category = category or None
        self.price_min = _to_int(price_min)
        self.price_max = _to_int(price_max)
        self.purpose = purpose or None  # "sale" / "rent" — None = both
        self.since_hours = _to_int(since_hours)
        self.full_scrape = str(full_scrape).lower() == "true"
        self.max_records = _to_int(max_records)
        self.job_id = job_id

        self.targeted = any([self.city, self.category, self.price_min, self.price_max, self.purpose])
        self.max_pages = 999 if self.full_scrape else 3

        # Written by the pipeline, not by the spider itself — pipeline increments records_collected after a successful save, and raisesCloseSpider once max_records is hit.
        self.records_collected = 0
        self.records_rejected = 0

        # Owned by the spider — counts detail-page requests DISPATCHED (not responses processed). Used only to cap new dispatch; never checked at the top of a callback handling an already-fetched response (see should_dispatch docstring).
        self.dispatched = 0
        self.errors = []

    # ── Category mapping ────────────────────────────────────────────

    def platform_category(self, canonical: str):
        """Maps a canonical category to this platform's own value, or None if this platform doesn't support it."""
        return self.CATEGORY_MAP.get(canonical)

    # ── Dispatch cap ─────────────────────────────────────────────────

    def should_dispatch(self) -> bool:
        if self.max_records is None:
            return True
        if self.records_collected >= self.max_records:
            return False
        if self.dispatched >= self.max_records * 10:
            return False
        return True

    # ── Item builder ─────────────────────────────────────────────────

    def build_item(self, **kwargs) -> PropertyItem:
        item = PropertyItem()
        item["platform"] = self.platform_name
        for key, value in kwargs.items():
            item[key] = value
        return item

    # ── Error handler ────────────────────────────────────────────────

    def handle_error(self, failure):
        url = failure.request.url
        msg = str(failure.value)
        self.logger.error(f"[{self.platform_name}] Request failed: {url} — {msg}")
        self.errors.append({"url": url, "error": msg})

    # ── Optional progress callback (only fires if job_id + CALLBACK_BASE_URL set) ──

    def report_progress(self):
        if not self.job_id:
            return
        callback = os.getenv("CALLBACK_BASE_URL")
        if not callback:
            return
        try:
            import requests
            requests.post(
                f"{callback}/internal/jobs/{self.job_id}/progress",
                json={"count": self.records_collected, "limit": self.max_records},
                timeout=2,
            )
        except Exception:
            self.logger.warning(f"[{self.platform_name}] progress callback failed")

    # ── Closed ───────────────────────────────────────────────────────

    def closed(self, reason):
        self.logger.info(
            f"\n{'='*60}\n"
            f"[{self.platform_name}] Spider finished\n"
            f"  Reason    : {reason}\n"
            f"  Collected : {self.records_collected}\n"
            f"  Rejected  : {self.records_rejected}\n"
            f"  Errors    : {len(self.errors)}\n"
            f"{'='*60}"
        )
        if not self.job_id:
            return
        callback = os.getenv("CALLBACK_BASE_URL")
        if not callback:
            return
        try:
            import requests
            requests.post(
                f"{callback}/internal/jobs/{self.job_id}/finished",
                json={"count": self.records_collected, "reason": reason},
                timeout=3,
            )
        except Exception:
            self.logger.warning(f"[{self.platform_name}] finished callback failed")
