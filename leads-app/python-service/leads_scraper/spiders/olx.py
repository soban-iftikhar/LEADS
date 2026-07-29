import re
import json
import scrapy
from itertools import product
from leads_scraper.spiders.base_spider import BaseSpider


class OLXSpider(BaseSpider):
    name = "olx"
    platform_name = "olx"
    allowed_domains = ["olx.com.pk"]
    BASE_URL = "https://www.olx.com.pk"

    CITIES = ["islamabad", "lahore", "karachi", "rawalpindi", "peshawar", "faisalabad"]

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

    # ── Request resolution (targeted vs general) ────────────────────────

    def _resolve_cities(self):
        if self.city:
            match = next((c for c in self.CITIES if c == self.city.lower()), None)
            if not match:
                self.logger.error(f"[olx] Unsupported city: {self.city}")
                return []
            return [match]
        if self.full_scrape:
            return list(self.CITIES)
        return ["islamabad", "lahore", "karachi"]

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
        cities = self._resolve_cities()
        categories = self._resolve_categories()
        if not cities or not categories:
            return

        for city, (canon_cat, cat_path) in product(cities, categories.items()):
            url = self._build_search_url(cat_path, city)
            yield scrapy.Request(
                url=url,
                callback=self.parse_listing_page,
                cb_kwargs={"city": city.title(), "canonical_category": canon_cat, "cat_path": cat_path, "page": 1},
                errback=self.handle_error,
            )

    def _build_search_url(self, cat_path, city):
        separator = "&" if "?" in cat_path else "?"
        return f"{self.BASE_URL}{cat_path}{separator}location={city}"

    # ── Listing page ─────────────────────────────────────────────────────

    def parse_listing_page(self, response, city, canonical_category, cat_path, page):
        self.logger.info(f"[olx] {city}/{canonical_category} page {page} — {response.url}")

        cards = response.css("li[aria-label='Listing']")
        if not cards:
            self.logger.warning(f"[olx] 0 listing cards: {response.url}")
            return

        for card in cards:
            if not self.should_dispatch():
                return
            href = card.css("a[title]::attr(href)").get("")
            if not href:
                continue
            url = href if href.startswith("http") else self.BASE_URL + href
            card_data = self._extract_card_data(card)

            self.dispatched += 1
            yield scrapy.Request(
                url=url,
                callback=self.parse_detail,
                cb_kwargs={"city": city, "canonical_category": canonical_category, "card_data": card_data},
                errback=self.handle_error,
            )

        if self.should_dispatch() and page < self.max_pages:
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

    # ── Detail page ──────────────────────────────────────────────────────

    def parse_detail(self, response, city, canonical_category, card_data):
        # Already fetched — only bail on the real goal, never should_dispatch().
        if self.max_records is not None and self.records_collected >= self.max_records:
            return
        if response.status in (403, 429):
            self.logger.warning(f"[olx] Blocked [{response.status}]: {response.url}")
            return

        listing_id = self._extract_id(response.url)

        title = response.css("h1::text").get("").strip() or card_data["title_card"]
        price = self._extract_price_text(response) or card_data["price_card"]
        locality = self._extract_locality_text(response) or card_data["location_card"]

        bedrooms = response.xpath(
            "//span[normalize-space(text())='Bedrooms']/following-sibling::span/text()"
        ).get("") or card_data["beds_card"]
        bathrooms = response.xpath(
            "//span[normalize-space(text())='Bathrooms']/following-sibling::span/text()"
        ).get("") or card_data["baths_card"]
        size = response.xpath(
            "//span[normalize-space(text())='Area']/following-sibling::span/text()"
        ).get("") or card_data["size_card"]
        bedrooms, bathrooms, size = bedrooms.strip(), bathrooms.strip(), size.strip()

        added_date = (
            response.css("span[aria-label='Creation date']::text").get("") or card_data["added_date_card"]
        ).strip()

        desc_parts = response.css("div[aria-label='Description'] *::text").getall()
        description = " ".join(p.strip() for p in desc_parts if p.strip() and p.strip() != "Description")

        seller_name = response.xpath(
            "//span[normalize-space(text())='Posted by']/following-sibling::div[1]//span/text()"
        ).get("").strip()

        item = self.build_item(
            listing_id=listing_id,
            url=response.url,
            title=title,
            price=price,
            city=city,
            locality=locality,
            location=locality,
            category=canonical_category,
            purpose="sale",
            description=description,
            seller_name=seller_name,
            agency_name="",
            agency_profile_url="",
            phone="",
            mobile="",
            bedrooms=bedrooms,
            bathrooms=bathrooms,
            size=size,
            added_date=added_date,
            amenities=[],
            is_project=False,
        )

        if self.access_token:
            contact_url = f"{self.BASE_URL}/api/listing/{listing_id}/contactInfo/"
            yield scrapy.Request(
                url=contact_url,
                callback=self.parse_contact_info,
                cb_kwargs={"item": item},
                headers={
                    "Accept": "application/json",
                    "Referer": response.url,
                    "X-Requested-With": "XMLHttpRequest",
                },
                cookies={"kc_access_token": self.access_token, "kc_id_token": self.id_token},
                errback=self.handle_error,
            )
        else:
            yield item

    def _build_next_page_url(self, current_url: str, next_page: int) -> str:
        if re.search(r"[?&]page=\d+", current_url):
            return re.sub(r"([?&]page=)\d+", rf"\g<1>{next_page}", current_url)
        separator = "&" if "?" in current_url else "?"
        return f"{current_url}{separator}page={next_page}"

    # ── Contact info API ─────────────────────────────────────────────────

    def parse_contact_info(self, response, item):
        if response.status == 401:
            # Token's dead for the rest of this run — stop spending a
            # request per listing trying it again.
            if self.access_token:
                self.logger.error(
                    f"[olx] OLX_ACCESS_TOKEN expired/invalid (401 on {response.url}). "
                    f"Skipping contact lookups for the rest of this run."
                )
                self.access_token = None
            yield item
            return

        try:
            data = json.loads(response.text)
            item["seller_name"] = data.get("name", "") or item.get("seller_name", "")
            mobile_numbers = data.get("mobileNumbers") or []
            item["mobile"] = mobile_numbers[0] if mobile_numbers else data.get("mobile", "")
            item["phone"] = item["mobile"]
        except Exception as e:
            self.logger.warning(f"[olx] contactInfo parse error: {e} — status {response.status} — body: '{response.text[:150]}'")
            item["mobile"] = ""
            item["phone"] = ""

        yield item

    # ── Helpers ──────────────────────────────────────────────────────────

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
