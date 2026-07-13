import scrapy
from leads_scraper.items import PropertyItem


class BaseSpider(scrapy.Spider):
    """
    All shared logic lives here.
    Child spiders only define selectors and URL structure.
    """

    platform_name = None  # must be set by child

    custom_settings = {}  # child can override per-platform if needed

    def __init__(self, full_scrape=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.full_scrape = str(full_scrape).lower() == "true"
        self.max_pages   = 999 if self.full_scrape else 3
        self.records_collected = 0
        self.records_rejected  = 0
        self.errors            = []

    # ── Shared item builder 

    def build_item(self, **kwargs) -> PropertyItem:
        item = PropertyItem()
        for key, value in kwargs.items():
            item[key] = value
        item["platform"] = self.platform_name
        return item

    # ── Error handler 

    def handle_error(self, failure):
        url = failure.request.url
        self.logger.error(f"[{self.platform_name}] Failed: {url} — {failure.value}")
        self.errors.append(str(failure.value))

    # ── Closed 

    def closed(self, reason):
        self.logger.info(
            f"[{self.platform_name}] Finished — "
            f"Collected: {self.records_collected} | "
            f"Rejected: {self.records_rejected} | "
            f"Errors: {len(self.errors)} | "
            f"Reason: {reason}"
        )