import json
from itertools import product

import scrapy

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
        self.revealed = 0
        self.rate_limited = 0
        self.reveal_paused = False  # set when Ilaan answers 429: no more reveal calls this run

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
        for (_city, city_id), (canon_cat, api_type), (purpose_name, status) in product(
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
        # Ilaan gives no date for unverified listings, but the feed is ordered by id, newest
        # first. Inside a window run, "fresh" = verified inside the window, or not stored yet.
        known, with_phone = (self._known_ids([str(e.get("propertyId")) for e in items])
                             if self.cutoff else (set(), set()))
        fresh = 0
        for entry in items:
            if not self.should_dispatch():
                return
            pid = str(entry.get("propertyId"))
            revealable = self._revealable(entry)
            if self.cutoff:
                if entry.get("verifiedDate"):
                    if not self.is_fresh(entry["verifiedDate"]):
                        continue
                elif pid in known:
                    # Already stored. Come back only for a number we could not get last time
                    # (reveal rate limit), and only while reveals are still allowed.
                    if not (revealable and pid not in with_phone and not self.reveal_paused):
                        self.skipped_old += 1
                        continue
            fresh += 1
            ctx = {"category": canonical_category, "purpose": purpose_name,
                   "city": entry.get("cityName"), "url": None}
            search = {"type": api_type, "status": status}  # needed to build the listing URL
            self.dispatched += 1
            if not revealable or self.reveal_paused:
                yield self.raw_item({"listing": entry, "reveal_contact": None, "search": search}, **ctx)
                continue
            yield scrapy.Request(
                url=self.REVEAL_URL.format(property_id=entry["propertyId"]),
                method="POST",
                callback=self.reveal_contact,
                cb_kwargs={"entry": entry, "ctx": ctx, "search": search},
                headers={"Accept": "application/json", "Content-Type": "application/json",
                         "Origin": "https://www.ilaan.com", "Referer": "https://www.ilaan.com/",
                         "X-CSRF-Token": self.csrf_token or ""},
                # Ilaan authenticates with the `auth_token` cookie from a logged-in session.
                cookies={"auth_token": self.auth_token},
                body=b"",
                errback=self.handle_error,
                # 429 is handled in reveal_contact (stop revealing), never retried
                meta={"handle_httpstatus_list": [401, 403, 429], "dont_retry": True},
                dont_filter=True,
            )

        pagination = outer.get("pagination", {})
        if self.keep_paging(fresh, page) and pagination.get("hasMore") and pagination.get("nextPage"):
            yield self._listing_request(
                canonical_category, purpose_name, api_type, status, page=pagination["nextPage"], city_id=city_id
            )

    def _revealable(self, entry: dict) -> bool:
        """Free to reveal: logged in, unverified seller, and the feed shows a masked number.

        Verified and gold-verified sellers' numbers are paid. If the masked number
        (0304-XXXXXXX) is blank, reveal-contact returns an empty phone, so it is not called.
        """
        has_number = bool(entry.get("agentPhone") or entry.get("agentWhatsApp"))
        return bool(self.auth_token) and has_number and not (
            entry.get("isVerified") or entry.get("isGoldVerified"))

    def _known_ids(self, ids: list[str]) -> tuple[set[str], set[str]]:
        """(ids already stored, ids stored with a phone)."""
        from leads.db import get_pool
        try:
            with get_pool().connection() as conn:
                rows = conn.execute(
                    "SELECT external_id, phone_hash IS NOT NULL FROM ilaan.listings "
                    "WHERE external_id = ANY(%s)", (ids,)).fetchall()
            return {r[0] for r in rows}, {r[0] for r in rows if r[1]}
        except Exception as e:  # noqa: BLE001 - if the lookup fails, treat everything as new
            self.logger.warning(f"[ilaan] known-id lookup failed: {e}")
            return set(), set()

    # Reveal contact

    def reveal_contact(self, response, entry, ctx, search):
        try:
            body = json.loads(response.text)
        except ValueError:
            body = None
        message = ((body or {}).get("error") or (body or {}).get("message") or "").lower()

        if response.status == 429:
            # Ilaan's reveal rate limit. Respect it: no more reveal calls in this run. Listings
            # are saved without a phone and picked up again by a later run.
            self.rate_limited += 1
            if not self.reveal_paused:
                self.reveal_paused = True
                limits = {k.decode(): v[0].decode() for k, v in response.headers.items()
                          if k.lower().startswith((b"x-rate-limit", b"retry-after"))}
                self.logger.warning(
                    f"[ilaan] reveal rate limit reached after {self.revealed} numbers "
                    f"({limits or 'no limit headers'}); no more reveal calls in this run")
            yield self.raw_item({"listing": entry, "reveal_contact": None, "search": search}, **ctx)
            return

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
            yield self.raw_item({"listing": entry, "reveal_contact": None, "search": search}, **ctx)
            return
        if body is None:
            self.logger.warning(f"[ilaan] reveal-contact not JSON (status {response.status})")
        else:
            self.revealed += 1
        remaining = response.headers.get("X-Rate-Limit-Remaining")
        if remaining is not None and remaining.strip().isdigit() and int(remaining) <= 0:
            self.reveal_paused = True  # used the last allowed reveal: stop before a 429
        yield self.raw_item({"listing": entry, "reveal_contact": {"status": response.status, "body": body},
                             "search": search}, **ctx)

    def closed(self, reason):
        super().closed(reason)
        self.logger.info(
            f"[ilaan] numbers revealed={self.revealed} paywalled={self.paywalled} "
            f"rate_limited={self.rate_limited} reveals_paused={self.reveal_paused}")
