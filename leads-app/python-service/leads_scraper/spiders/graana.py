import json
import re
import scrapy
from itertools import product
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

    CITIES = ["Islamabad", "Lahore", "Karachi", "Rawalpindi", "Peshawar", "Faisalabad"]
    PURPOSE_PATHS = {"sale": "sale", "rent": "rent"}
    PAGE_SIZE = 30

    # ── Request resolution (targeted vs general) ────────────────────────

    def _resolve_cities(self):
        if self.city:
            match = next((c for c in self.CITIES if c.lower() == self.city.lower()), None)
            if not match:
                self.logger.error(f"[graana] Unsupported city: {self.city}")
                return []
            return [match]
        if self.full_scrape:
            return list(self.CITIES)
        return ["Islamabad", "Lahore", "Karachi"]

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
        cities = self._resolve_cities()
        categories = self._resolve_categories()
        purposes = self._resolve_purposes()
        if not cities or not categories or not purposes:
            return

        for city, (canon_cat, cat_slug), (purpose_name, purpose_path) in product(
            cities, categories.items(), purposes.items()
        ):
            url = (
                f"{self.BASE_URL}/{purpose_path}/"
                f"{cat_slug}-{purpose_path}-{city}-1/"
                f"?pageSize={self.PAGE_SIZE}&page=1"
            )
            yield scrapy.Request(
                url=url,
                callback=self.parse_listing_page,
                cb_kwargs={
                    "canonical_category": canon_cat,
                    "cat_slug": cat_slug,
                    "city": city,
                    "purpose_name": purpose_name,
                    "purpose_path": purpose_path,
                    "page": 1,
                },
                errback=self.handle_error,
            )

    # ── Listing page ─────────────────────────────────────────────────────

    def parse_listing_page(self, response, canonical_category, cat_slug, city, purpose_name, purpose_path, page):
        self.logger.info(f"[graana] {city}/{canonical_category}/{purpose_name} page {page} — {response.url}")

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
                f"{cat_slug}-{purpose_path}-{city}-1/"
                f"?pageSize={self.PAGE_SIZE}&page={next_page}"
            )
            yield scrapy.Request(
                url=next_url,
                callback=self.parse_listing_page,
                cb_kwargs={
                    "canonical_category": canonical_category,
                    "cat_slug": cat_slug,
                    "city": city,
                    "purpose_name": purpose_name,
                    "purpose_path": purpose_path,
                    "page": next_page,
                },
                errback=self.handle_error,
            )

    # ── Detail page ──────────────────────────────────────────────────────

    def parse_detail(self, response, canonical_category, city, purpose_name, card_data):
        if self.max_records is not None and self.records_collected >= self.max_records:
            return
        if response.status in (403, 429):
            self.logger.warning(f"[graana] Blocked {response.status}: {response.url}")
            self.records_rejected += 1
            return

        raw = response.css("script#__NEXT_DATA__::text").get()
        if not raw:
            self.logger.warning(f"[graana] No __NEXT_DATA__ blob found — falling back to card data: {response.url}")
            yield self.build_item(
                listing_id=self._extract_id(response.url),
                url=response.url,
                title="",
                price=card_data["price"],
                city=city,
                locality=card_data["location"],
                location=card_data["location"],
                category=canonical_category,
                purpose=purpose_name,
                description="",
                seller_name="",
                agency_name="",
                agency_profile_url="",
                phone="",
                mobile="",
                bedrooms="",
                bathrooms="",
                size="",
                added_date=card_data["date"],
                amenities=[],
                is_project=False,
            )
            return

        try:
            payload = json.loads(raw)
            prop = payload["props"]["pageProps"]["data"]
        except Exception as e:
            self.logger.error(f"[graana] Could not parse __NEXT_DATA__: {e} — {response.url}")
            return

        size_value = prop.get("size")
        size_unit = prop.get("sizeUnit", "")
        size = f"{size_value} {size_unit}".strip() if size_value is not None else ""

        agency = prop.get("agency") or {}
        amenities = self._flatten_features(prop)

        item = self.build_item(
            listing_id=str(prop.get("id", self._extract_id(response.url))),
            url=response.url,
            title=prop.get("customTitle", "") or "",
            price=str(prop.get("price", "")),
            city=prop.get("city.name") or city,
            locality=prop.get("area.name") or prop.get("address", ""),
            location=prop.get("address", "") or prop.get("area.name", ""),
            category=prop.get("subtype") or canonical_category,
            purpose="rent" if prop.get("purpose") == "rent" else "sale",
            description=prop.get("description") or "",
            seller_name=prop.get("name", "") or agency.get("name", ""),
            agency_name=agency.get("name", ""),
            agency_profile_url="",
            phone=prop.get("phone", "") or "",
            mobile=prop.get("phone", "") or "",
            bedrooms=str(prop.get("bed", "") or ""),
            bathrooms=str(prop.get("bath", "") or ""),
            size=size,
            added_date=prop.get("createdAt", "") or "",
            amenities=amenities,
            is_project=False,
        )

        yield item

    def _flatten_features(self, prop: dict) -> list:
        amenities = []
        for key in (
            "primaryFeatures",
            "secondaryFeatures",
            "utilityFeatures",
            "communicationFeatures",
            "nearByFeatures",
        ):
            features = prop.get(key) or {}
            for name, value in features.items():
                amenities.append(f"{name}: {value}" if value not in (None, "", True) else name)
        return amenities

    # ── Helpers ──────────────────────────────────────────────────────────

    def _extract_price_from_card(self, card) -> str:
        for text in card.css("*::text").getall():
            t = text.strip()
            lower = t.lower()
            if "crore" in lower or "lakh" in lower or "lac" in lower:
                return t
        return ""

    def _extract_price_from_page(self, response) -> str:
        price = response.css("span.mui-style-1k6ms13::text").get("").strip()
        if price:
            return price
        for text in response.css("span::text, div::text").getall():
            t = text.strip()
            lower = t.lower()
            if "crore" in lower or "lakh" in lower or "lac" in lower:
                return t
        return ""

    def _extract_amenities(self, response) -> list:
        amenities = []
        for text in response.css(
            "[class*='amenity'] *::text, [class*='feature'] span::text, [class*='Chip'] span::text"
        ).getall():
            t = text.strip()
            if t and len(t) > 1:
                amenities.append(t)
        return list(set(amenities))

    def _extract_id(self, url: str) -> str:
        match = re.search(r"-(\d{5,})/?$", url.rstrip("/"))
        return match.group(1) if match else url.split("/")[-1]