import scrapy
from leads_scraper.items import PropertyItem

class BaseSpider(scrapy.Spider):
    """
    Base class for all LEADS platform scrapers.
    """
    
    platform_name = None  

    def __init__(self, full_scrape=False, max_records=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.full_scrape  = str(full_scrape).lower() == "true"
        self.max_pages    = 999 if self.full_scrape else 3
        self.max_records  = int(max_records) if max_records else None

        # ── Counters written by pipelines, NOT by spiders ─────────────────
        # Spider increments nothing — pipeline increments after
        # successful clean (records_rejected) or successful save (records_collected)
        self.records_collected = 0
        self.records_rejected  = 0
        self.errors            = []

    # ── Item builder ──────────────────────────────────────────────────────────

    def build_item(self, **kwargs) -> PropertyItem:
        """
        Build a PropertyItem with platform_name pre-filled.
        Child spiders call this instead of instantiating PropertyItem directly.
        """
        item = PropertyItem()
        item["platform"] = self.platform_name
        for key, value in kwargs.items():
            item[key] = value
        return item

    # ── Error handler ─────────────────────────────────────────────────────────

    def handle_error(self, failure):
        url = failure.request.url
        msg = str(failure.value)
        self.logger.error(f"[{self.platform_name}] Request failed: {url} — {msg}")
        self.errors.append({"url": url, "error": msg})

    # ── Closed ────────────────────────────────────────────────────────────────

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
