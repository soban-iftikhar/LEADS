import json
import re
import scrapy
from itertools import product
from leads_scraper.extract import next_data
from leads_scraper.spiders.base_spider import BaseSpider


class GraanaSpider(BaseSpider):
    name = "graana"
    platform_name = "graana"
    allowed_domains = ["graana.com"]
    BASE_URL = "https://www.graana.com"

    # canonical -> Graana's own path-based slug (stable, not hash-based)
    CATEGORY_MAP = {
        "house": "house",
        "flat": "flat",
        "portion": "upper-portion",
        "room": "room",
        "farmhouse": "farm-house",
        "penthouse": "pent-house",
        # Graana doesn't split plots by residential/commercial in the
        # slug — both canonical categories map to the same "plot" listing
        # set. That's a real platform limitation, not a bug: filter
        # further on price/description if you need the split.
        "residential_plot": "plot",
        "commercial_plot": "plot",
        "commercial_other": "commercial",
        "shop": "shop",
        "office": "office",
        "warehouse": "warehouse",
        "factory": "factory",
        "building": "building",
    }

    PURPOSE_PATHS = {"sale": "sale", "rent": "rent"}
    PAGE_SIZE = 30

    custom_settings = {
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "AUTOTHROTTLE_START_DELAY": 10,
        "AUTOTHROTTLE_MAX_DELAY": 90,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 0.5,
    }

    # Request resolution (targeted vs general)

    def _resolve_categories(self):
        if self.category:
            plat_cat = self.platform_category(self.category)
            if not plat_cat:
                self.logger.warning(f"[graana] Category '{self.category}' not supported on Graana")
                return {}
            return {self.category: plat_cat}
        if self.full_scrape:
            seen, out = set(), {}
            for canon, plat in self.CATEGORY_MAP.items():
                if plat not in seen:
                    seen.add(plat)
                    out[canon] = plat
            return out
        return {"house": "house", "flat": "flat", "residential_plot": "plot", "shop": "shop"}

    def _resolve_purposes(self):
        if self.purpose:
            path = self.PURPOSE_PATHS.get(self.purpose)
            if not path:
                self.logger.error(f"[graana] Unsupported purpose: {self.purpose}")
                return {}
            return {self.purpose: path}
        if self.full_scrape:
            return dict(self.PURPOSE_PATHS)
        return {"sale": "sale"}

    def start_requests(self):
        cities = self.cities()
        categories = self._resolve_categories()
        purposes = self._resolve_purposes()
        if not cities or not categories or not purposes:
            return

        for (city, city_slug), (canon_cat, cat_slug), (purpose_name, purpose_path) in product(
            cities, categories.items(), purposes.items()
        ):
            url = (
                f"{self.BASE_URL}/{purpose_path}/"
                f"{cat_slug}-{purpose_path}-{city_slug}/"
                f"?pageSize={self.PAGE_SIZE}&page=1"
            )
            yield scrapy.Request(
                url=url,
                callback=self.parse_listing_page,
                cb_kwargs={
                    "canonical_category": canon_cat,
                    "cat_slug": cat_slug,
                    "city": city,
                    "city_slug": city_slug,
                    "purpose_name": purpose_name,
                    "purpose_path": purpose_path,
                    "page": 1,
                },
                errback=self.handle_error,
            )

    # Listing page

    def parse_listing_page(self, response, canonical_category, cat_slug, city, city_slug, purpose_name, purpose_path, page):
        self.logger.info(f"[graana] {city}/{canonical_category}/{purpose_name} page {page} — {response.url}")

        self.pages_fetched += 1
        cards = response.css("a[href*='/property/']")
        if not cards:
            self.logger.warning(f"[graana] No listing links found — possible block or structure change — {response.url}")
            return

        seen_hrefs = set()
        for card in cards:
            if not self.should_dispatch():
                return
            href = card.attrib.get("href", "")
            if not href or href in seen_hrefs or "/property/" not in href:
                continue
            seen_hrefs.add(href)

            detail_url = href if href.startswith("http") else self.BASE_URL + href
            card_data = {
                "price": self._extract_price_from_card(card),
                "location": card.css("h5::text").get("").strip(),
                "type": card.css("div.MuiTypography-body2New::text").get("").strip(),
                "date": card.css("div.MuiTypography-captionNew::text").get("").strip(),
            }

            self.dispatched += 1
            yield scrapy.Request(
                url=detail_url,
                callback=self.parse_detail,
                cb_kwargs={
                    "canonical_category": canonical_category,
                    "city": city,
                    "purpose_name": purpose_name,
                    "card_data": card_data,
                },
                errback=self.handle_error,
            )

        if self.should_dispatch() and page < self.max_pages and len(seen_hrefs) >= self.PAGE_SIZE:
            next_page = page + 1
            next_url = (
                f"{self.BASE_URL}/{purpose_path}/"
                f"{cat_slug}-{purpose_path}-{city_slug}/"
                f"?pageSize={self.PAGE_SIZE}&page={next_page}"
            )
            yield scrapy.Request(
                url=next_url,
                callback=self.parse_listing_page,
                cb_kwargs={
                    "canonical_category": canonical_category,
                    "cat_slug": cat_slug,
                    "city": city,
                    "city_slug": city_slug,
                    "purpose_name": purpose_name,
                    "purpose_path": purpose_path,
                    "page": next_page,
                },
                errback=self.handle_error,
            )

    # Detail page

    def parse_detail(self, response, canonical_category, city, purpose_name, card_data):
        if self.max_records is not None and self.records_collected >= self.max_records:
            return
        if response.status in (403, 429):
            self.logger.warning(f"[graana] Blocked {response.status}: {response.url}")
            return
        try:
            detail = next_data(response.text)["props"]["pageProps"]["data"]
            if not detail:
                raise ValueError("empty pageProps.data")
        except (ValueError, KeyError, TypeError) as e:
            self.logger.warning(f"[graana] no listing data ({e}): {response.url}")
            self.errors.append({"url": response.url, "error": f"no listing data: {e}"})
            return
        yield self.raw_item(
            {"detail": detail, "source_url": response.url},
            category=canonical_category, purpose=purpose_name, city=city, url=response.url,
        )

    # Helpers

    def _extract_price_from_card(self, card) -> str:
        for text in card.css("*::text").getall():
            t = text.strip()
            lower = t.lower()
            if "crore" in lower or "lakh" in lower or "lac" in lower:
                return t
        return ""

    def _extract_id(self, url: str) -> str:
        match = re.search(r"-(\d{5,})/?$", url.rstrip("/"))
        return match.group(1) if match else url.split("/")[-1]