import json
import re
from itertools import product

import scrapy

from leads_scraper.extract import hit_dates, window_state
from leads_scraper.spiders.base_spider import BaseSpider


class OLXSpider(BaseSpider):
    name = "olx"
    platform_name = "olx"
    allowed_domains = ["olx.com.pk"]
    BASE_URL = "https://www.olx.com.pk"

    # canonical -> (path, needs a separator-aware join — see _build_search_url)
    CATEGORY_MAP = {
        "house": "/houses_c1721/",
        "flat": "/apartments-flats_c1725/",
        "portion": "/portions-floors_c41/",
        "shop": "/shops-offices-commercial-space_c1733/?filter=type_eq_shop-sale",
        "residential_plot": "/residential-plots-land-plots_c40/?filter=type_eq_residential-plots-sale",
        "commercial_plot": "/commercial-plots-land-plots_c40/?filter=type_eq_commercial-plots-sale",
        "building": "/shops-offices-commercial-space_c1733/?filter=type_eq_building-sale",
        "office": "/shops-offices-commercial-space_c1733/?filter=type_eq_office-sale",
        # room, farmhouse, penthouse, warehouse, factory, commercial_other:
        # not supported on OLX — intentionally absent.
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.access_token = None
        self.id_token = None

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super().from_crawler(crawler, *args, **kwargs)
        spider.access_token = crawler.settings.get("OLX_ACCESS_TOKEN")
        spider.id_token = crawler.settings.get("OLX_ID_TOKEN")
        return spider

    # Request resolution (targeted vs general)

    def _resolve_categories(self):
        if self.category:
            plat_cat = self.platform_category(self.category)
            if not plat_cat:
                self.logger.warning(f"[olx] Category '{self.category}' not supported on OLX")
                return {}
            return {self.category: plat_cat}
        if self.full_scrape:
            return dict(self.CATEGORY_MAP)
        return {"house": "/houses_c1721/", "flat": "/apartments-flats_c1725/"}

    def start_requests(self):
        cities = self.cities()
        categories = self._resolve_categories()
        if not cities or not categories:
            return

        for (city, city_path), (canon_cat, cat_path) in product(cities, categories.items()):
            url = self._build_search_url(cat_path, city_path)
            yield scrapy.Request(
                url=url,
                callback=self.parse_listing_page,
                cb_kwargs={"city": city, "canonical_category": canon_cat, "cat_path": cat_path, "page": 1},
                errback=self.handle_error,
            )

    def _build_search_url(self, cat_path, city_path):
        # OLX filters by city in the path (/islamabad_g4060615/houses_c1721/); ?location= is ignored.
        return f"{self.BASE_URL}/{city_path}{cat_path}"

    # Listing page

    def parse_listing_page(self, response, city, canonical_category, cat_path, page):
        self.logger.info(f"[olx] {city}/{canonical_category} page {page} — {response.url}")

        self.pages_fetched += 1
        cards = response.css("li[aria-label='Listing']")
        if not cards:
            self.logger.warning(f"[olx] 0 listing cards: {response.url}")
            return

        # Each search hit carries the listing's last refresh time; anything older than the
        # window is skipped without opening its detail page.
        try:
            dates = hit_dates(window_state(response.text))
        except ValueError:
            dates = {}

        fresh = 0
        for card in cards:
            if not self.should_dispatch():
                return
            href = card.css("a[title]::attr(href)").get("")
            if not href:
                continue
            url = href if href.startswith("http") else self.BASE_URL + href
            ext = self._extract_id(url)
            if ext in dates and not self.is_fresh(dates[ext]):
                continue
            fresh += 1
            card_data = self._extract_card_data(card)

            self.dispatched += 1
            yield scrapy.Request(
                url=url,
                callback=self.parse_detail,
                cb_kwargs={"city": city, "canonical_category": canonical_category, "card_data": card_data},
                errback=self.handle_error,
            )

        if self.keep_paging(fresh, page):
            next_url = self._build_next_page_url(response.url, page + 1)
            yield scrapy.Request(
                url=next_url,
                callback=self.parse_listing_page,
                cb_kwargs={"city": city, "canonical_category": canonical_category, "cat_path": cat_path, "page": page + 1},
                errback=self.handle_error,
            )

    def _extract_card_data(self, card) -> dict:
        return {
            "title_card": card.css("a[title]::attr(title)").get("").strip(),
            "price_card": self._extract_price_text(card),
            "location_card": self._extract_locality_text(card),
            "size_card": card.css("span[aria-label='Area'] span::text").get("").strip(),
            "beds_card": card.css("span[aria-label='Beds'] span::text").get("").strip(),
            "baths_card": card.css("span[aria-label='Bathrooms'] span::text").get("").strip(),
            "added_date_card": card.css("span[aria-label='Creation date']::text").get("").strip(),
        }

    # Detail page

    def parse_detail(self, response, city, canonical_category, card_data):
        if self.max_records is not None and self.records_collected >= self.max_records:
            return
        if response.status in (403, 429):
            self.logger.warning(f"[olx] Blocked [{response.status}]: {response.url}")
            return
        try:
            detail = window_state(response.text)["ad"]["data"]
        except (ValueError, KeyError, TypeError) as e:
            self.logger.warning(f"[olx] no listing data ({e}): {response.url}")
            self.errors.append({"url": response.url, "error": f"no listing data: {e}"})
            return
        if not self.is_fresh(detail.get("createdAt")):
            return
        ctx = {"category": canonical_category, "purpose": "sale", "city": city, "url": response.url}

        if self.access_token:
            yield scrapy.Request(
                url=f"{self.BASE_URL}/api/listing/{detail['externalID']}/contactInfo/",
                callback=self.parse_contact_info,
                cb_kwargs={"detail": detail, "ctx": ctx},
                headers={"Accept": "application/json", "Referer": response.url,
                         "X-Requested-With": "XMLHttpRequest"},
                cookies={"kc_access_token": self.access_token, "kc_id_token": self.id_token},
                errback=self.handle_error,
                meta={"handle_httpstatus_list": [401, 403]},
                dont_filter=True,
            )
        else:
            yield self.raw_item({"detail": detail, "contact_info": None}, **ctx)

    def _build_next_page_url(self, current_url: str, next_page: int) -> str:
        if re.search(r"[?&]page=\d+", current_url):
            return re.sub(r"([?&]page=)\d+", rf"\g<1>{next_page}", current_url)
        separator = "&" if "?" in current_url else "?"
        return f"{current_url}{separator}page={next_page}"

    # Contact info API

    def parse_contact_info(self, response, detail, ctx):
        if response.status in (401, 403):
            if self.access_token:
                self.logger.error(
                    f"[olx] OLX_ACCESS_TOKEN expired or invalid ({response.status}). "
                    f"Skipping contact lookups for the rest of this run."
                )
                self.access_token = None
                self.auth_failed = True
            yield self.raw_item({"detail": detail, "contact_info": None}, **ctx)
            return
        try:
            body = json.loads(response.text)
        except ValueError:
            body = None
            self.logger.warning(f"[olx] contactInfo not JSON (status {response.status})")
        yield self.raw_item({"detail": detail, "contact_info": {"status": response.status, "body": body}}, **ctx)

    # Helpers

    def _extract_price_text(self, selector) -> str:
        for text in selector.css("span::text, div::text").getall():
            t = text.strip()
            lower = t.lower()
            if lower.startswith("rs") or "crore" in lower or "lakh" in lower or "pkr" in lower:
                return t
        return ""

    def _extract_locality_text(self, selector) -> str:
        for text in selector.css("span::text, div::text").getall():
            t = text.strip()
            if "," in t and len(t) > 5:
                return t
        return ""

    def _extract_id(self, url: str) -> str:
        match = re.search(r"iid-(\d+)", url)
        if match:
            return match.group(1)
        match = re.search(r"-(\d+)/?$", url.rstrip("/"))
        return match.group(1) if match else url.split("/")[-1]
