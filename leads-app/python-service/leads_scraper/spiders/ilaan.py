import json
import scrapy
from itertools import product
from leads_scraper.spiders.base_spider import BaseSpider


class IlaanSpider(BaseSpider):
  
    name = "ilaan"
    platform_name = "ilaan"
    allowed_domains = ["ilaan.com", "npi.ilaan.com"]
    API_BASE = "https://npi.ilaan.com/api/properties-new/v2"
    REVEAL_URL = "https://npi.ilaan.com/api/properties-new/{property_id}/reveal-contact?channel=call"

    CATEGORY_MAP = {
        "house": "House",                
        "flat": "Flat",                  
        "residential_plot": "Plot",      
        "commercial_plot": "Plot",       
        "farmhouse": "Farmhouse",        
    }

    STATUS_MAP = {
        "sale": "ForSale",  
        "rent": "ForRent",   
    }

    PAGE_SIZE = 20

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = None
        self.csrf_token = None
        self.paywalled = 0

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super().from_crawler(crawler, *args, **kwargs)
        spider.auth_token = crawler.settings.get("ILAAN_AUTH_TOKEN") or None
        spider.csrf_token = crawler.settings.get("ILAAN_CSRF_TOKEN") or None
        if spider.auth_token and not spider.csrf_token:
            spider.logger.warning("[ilaan] ILAAN_CSRF_TOKEN not set: reveal-contact will be refused (403)")
        if not spider.auth_token:
            spider.logger.warning("[ilaan] ILAAN_AUTH_TOKEN not set: listings are saved without phone numbers")
        return spider

    # Request resolution (targeted vs general)

    def _resolve_categories(self):
        if self.category:
            plat_cat = self.platform_category(self.category)
            if not plat_cat:
                self.logger.warning(f"[ilaan] Category '{self.category}' not supported/confirmed on Ilaan yet")
                return {}
            return {self.category: plat_cat}
        if self.full_scrape:
            return dict(self.CATEGORY_MAP)
        return {"house": "House"}

    def _resolve_purposes(self):
        if self.purpose:
            status = self.STATUS_MAP.get(self.purpose)
            if not status:
                self.logger.error(f"[ilaan] Unsupported purpose: {self.purpose}")
                return {}
            return {self.purpose: status}
        if self.full_scrape:
            return dict(self.STATUS_MAP)
        return {"sale": "ForSale"}

    def start_requests(self):
        categories = self._resolve_categories()
        purposes = self._resolve_purposes()
        if not categories or not purposes:
            return

        cities = self.cities()
        for (city, city_id), (canon_cat, api_type), (purpose_name, status) in product(
            cities, categories.items(), purposes.items()
        ):
            yield self._listing_request(canon_cat, purpose_name, api_type, status, page=1, city_id=city_id)

    def _listing_request(self, canonical_category, purpose_name, api_type, status, page, city_id):
        # No verified=true: unverified sellers' numbers are free to reveal; verified ones are paid.
        url = (
            f"{self.API_BASE}?page={page}&pageSize={self.PAGE_SIZE}&cityId={city_id}"
            f"&type={api_type}&status={status}&areaUnit=Marla"
        )
        return scrapy.Request(
            url=url,
            callback=self.parse_listing_page,
            cb_kwargs={
                "canonical_category": canonical_category,
                "purpose_name": purpose_name,
                "api_type": api_type,
                "status": status,
                "page": page,
                "city_id": city_id,
            },
            headers={"Accept": "application/json"},
            errback=self.handle_error,
        )

    # Listing page (JSON API)


    def parse_listing_page(self, response, canonical_category, purpose_name, api_type, status, page, city_id):
        try:
            payload = json.loads(response.text)
        except Exception as e:
            self.logger.error(f"[ilaan] Could not parse listing JSON: {e} — {response.url}")
            return

        outer = payload.get("data")
        items = outer.get("data") if isinstance(outer, dict) else None
        if items is None:
            self.logger.error(
                f"[ilaan] Response shape changed — expected data.data to be a list. "
                f"Top-level keys: {list(payload.keys())}, data keys: "
                f"{list(outer.keys()) if isinstance(outer, dict) else outer} — {response.url}"
            )
            return

        self.logger.info(f"[ilaan] {len(items)} listings — page {page} — {response.url}")

        self.pages_fetched += 1
        for entry in items:
            if not self.should_dispatch():
                return
            ctx = {"category": canonical_category, "purpose": purpose_name,
                   "city": entry.get("cityName"), "url": None}
            self.dispatched += 1
            # Verified and gold-verified sellers' numbers are paid to reveal; only unverified ones are free.
            # The feed shows a masked number (0304-XXXXXXX) when one exists; if it is blank,
            # reveal-contact returns an empty phone, so the call is skipped.
            has_number = bool(entry.get("agentPhone") or entry.get("agentWhatsApp"))
            if (not self.auth_token or entry.get("isVerified") or entry.get("isGoldVerified")
                    or not has_number):
                yield self.raw_item({"listing": entry, "reveal_contact": None}, **ctx)
                continue
            yield scrapy.Request(
                url=self.REVEAL_URL.format(property_id=entry["propertyId"]),
                method="POST",
                callback=self.reveal_contact,
                cb_kwargs={"entry": entry, "ctx": ctx},
                headers={"Accept": "application/json", "Content-Type": "application/json",
                         "Origin": "https://www.ilaan.com", "Referer": "https://www.ilaan.com/",
                         "X-CSRF-Token": self.csrf_token or ""},
                # Ilaan authenticates with the `auth_token` cookie from a logged-in session.
                cookies={"auth_token": self.auth_token},
                body=b"",
                errback=self.handle_error,
                meta={"handle_httpstatus_list": [401, 403]},
                dont_filter=True,
            )

        pagination = outer.get("pagination", {})
        if self.should_dispatch() and pagination.get("hasMore") and pagination.get("nextPage"):
            yield self._listing_request(
                canonical_category, purpose_name, api_type, status, page=pagination["nextPage"], city_id=city_id
            )

    # Reveal contact

    def reveal_contact(self, response, entry, ctx):
        try:
            body = json.loads(response.text)
        except ValueError:
            body = None
        message = ((body or {}).get("error") or (body or {}).get("message") or "").lower()

        if response.status in (401, 403):
            paywalled = any(w in message for w in ("subscribe", "unlock", "prime"))
            if paywalled:
                # Paid listing for this account: save it without a phone, keep revealing others.
                self.paywalled += 1
            elif self.auth_token:
                self.logger.error(
                    f"[ilaan] login refused ({response.status}: {message or 'no message'}). "
                    f"ILAAN_AUTH_TOKEN / ILAAN_CSRF_TOKEN expired or invalid; "
                    f"saving the rest of this run without phone numbers."
                )
                self.auth_token = None
                self.auth_failed = True
            yield self.raw_item({"listing": entry, "reveal_contact": None}, **ctx)
            return
        if body is None:
            self.logger.warning(f"[ilaan] reveal-contact not JSON (status {response.status})")
        yield self.raw_item({"listing": entry, "reveal_contact": {"status": response.status, "body": body}}, **ctx)

    def closed(self, reason):
        super().closed(reason)
        if self.paywalled:
            self.logger.info(f"[ilaan] {self.paywalled} listings need Prime or an unlock; saved without phone")
