import re
import json
import scrapy
from itertools import product
from leads_scraper.spiders.base_spider import BaseSpider


class ZameenSpider(BaseSpider):
    name = "zameen"
    platform_name = "zameen"
    allowed_domains = ["zameen.com"]

    CITY_IDS = {
        "Islamabad": 3,
        "Lahore": 2,
        "Karachi": 1,
        "Rawalpindi": 41,
        "Peshawar": 6,
    }

    # canonical -> Zameen's own (coarse) category path. Zameen only
    # exposes 4 buckets, so several canonical categories collapse into
    # "Commercial" here — that's a real platform limitation, not a bug.
    CATEGORY_MAP = {
        "house": "Homes",
        "flat": "Flats",
        "residential_plot": "Plots",
        "commercial_plot": "Plots",
        "shop": "Commercial",
        "office": "Commercial",
        "warehouse": "Commercial",
        "factory": "Commercial",
        "building": "Commercial",
        "commercial_other": "Commercial",
    }

    PURPOSE_IDS = {"sale": 1, "rent": 2}

    HEADERS = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    # ── Request resolution (targeted vs general) ────────────────────────

    def _resolve_cities(self):
        if self.city:
            city_id = self.CITY_IDS.get(self.city)
            if not city_id:
                self.logger.error(f"[zameen] Unsupported city: {self.city}")
                return {}
            return {self.city: city_id}
        if self.full_scrape:
            return dict(self.CITY_IDS)
        return {"Islamabad": 3, "Lahore": 2, "Karachi": 1}

    def _resolve_categories(self):
        if self.category:
            plat_cat = self.platform_category(self.category)
            if not plat_cat:
                self.logger.warning(f"[zameen] Category '{self.category}' not supported on Zameen")
                return {}
            return {self.category: plat_cat}
        if self.full_scrape:
            # de-duplicate — several canonical keys map to "Commercial"
            seen, out = set(), {}
            for canon, plat in self.CATEGORY_MAP.items():
                if plat not in seen:
                    seen.add(plat)
                    out[canon] = plat
            return out
        return {"house": "Homes", "residential_plot": "Plots"}

    def _resolve_purposes(self):
        if self.purpose:
            pid = self.PURPOSE_IDS.get(self.purpose)
            if not pid:
                self.logger.error(f"[zameen] Unsupported purpose: {self.purpose}")
                return {}
            return {self.purpose: pid}
        if self.full_scrape:
            return dict(self.PURPOSE_IDS)
        return {"sale": 1}

    def start_requests(self):
        cities = self._resolve_cities()
        categories = self._resolve_categories()
        purposes = self._resolve_purposes()
        if not cities or not categories or not purposes:
            return

        for (city_name, city_id), (canon_cat, plat_cat), (purpose_name, purpose_id) in product(
            cities.items(), categories.items(), purposes.items()
        ):
            url = (
                f"https://www.zameen.com/{plat_cat}/"
                f"{city_name}-{city_id}-1.html?purpose={purpose_id}"
            )
            yield scrapy.Request(
                url=url,
                callback=self.parse,
                cb_kwargs={
                    "page": 1,
                    "city_name": city_name,
                    "canonical_category": canon_cat,
                    "purpose_name": purpose_name,
                },
                headers=self.HEADERS,
                errback=self.handle_error,
            )

    # ── Level 1: Search results page ────────────────────────────────────

    def parse(self, response, page, city_name, canonical_category, purpose_name):
        self.logger.info(f"[zameen] [{city_name}/{canonical_category}/{purpose_name}] page {page} — {response.url}")

        listings = response.css("li[aria-label='Listing']")
        if not listings:
            self.logger.warning(f"[zameen] 0 listings: {response.url}")
            return

        for listing in listings:
            if not self.should_dispatch():
                return
            link = listing.css("a[aria-label='Listing link']::attr(href)").get()
            if not link:
                link = listing.css("a::attr(href)").get()
            if not link:
                continue
            detail_url = link if link.startswith("http") else f"https://www.zameen.com{link}"

            self.dispatched += 1
            yield scrapy.Request(
                url=detail_url,
                callback=self.parse_property,
                cb_kwargs={
                    "city_name": city_name,
                    "canonical_category": canonical_category,
                    "purpose_name": purpose_name,
                },
                meta={
                    "playwright": True,
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                        "timeout": 30000,
                    },
                },
                headers={**self.HEADERS, "Referer": response.url},
                errback=self.handle_error,
            )

        if self.should_dispatch() and page < self.max_pages:
            next_url = self._get_next_page(response, page)
            if next_url:
                yield scrapy.Request(
                    url=next_url,
                    callback=self.parse,
                    cb_kwargs={
                        "page": page + 1,
                        "city_name": city_name,
                        "canonical_category": canonical_category,
                        "purpose_name": purpose_name,
                    },
                    headers=self.HEADERS,
                    errback=self.handle_error,
                )

    def _get_next_page(self, response, current_page):
        next_link = response.css("a[title='Next']::attr(href)").get()
        if next_link:
            return next_link if next_link.startswith("http") else f"https://www.zameen.com{next_link}"
        base_url = response.url.split("?")[0]
        match = re.search(r"-(\d+)(\.html)$", base_url)
        if match:
            next_page = current_page + 1
            next_url = base_url.replace(f"-{match.group(1)}{match.group(2)}", f"-{next_page}{match.group(2)}")
            if "?" in response.url:
                next_url += "?" + response.url.split("?")[1]
            return next_url
        return None

    # ── Level 2: Property detail page ───────────────────────────────────

    def parse_property(self, response, city_name, canonical_category, purpose_name):
        # This response is already fetched — only bail on the real goal
        # (max_records), never on should_dispatch().
        if self.max_records is not None and self.records_collected >= self.max_records:
            return
        if response.status in (403, 429):
            self.logger.warning(f"[zameen] Blocked [{response.status}]: {response.url}")
            return

        if not response.css("span[aria-label='Price']::text").get() and \
           not response.css("[aria-label='Title']::text").get():
            self.logger.warning(f"[zameen] Empty page or blocked: {response.url}")
            return

        item = self.build_item(is_project=False)
        item["listing_id"] = self._extract_listing_id(response.url)
        item["url"] = response.url
        item["title"] = (response.css("[aria-label='Title']::text").get("") or "").strip()
        item["location"] = (
            response.css("[aria-label='Property header']::text").get("")
            or response.css("[aria-label='Breadcrumb'] span:last-child::text").get("")
        ).strip()
        item["city"] = city_name
        item["locality"] = (response.css("span[aria-label='Location']::text").get("") or "").strip()
        item["price"] = (response.css("span[aria-label='Price']::text").get("") or "").strip()
        item["size"] = (response.css("[aria-label='Area'] *::text").get("") or "").strip()
        item["purpose"] = purpose_name
        item["category"] = canonical_category
        item["bedrooms"] = (response.css("[aria-label='Beds']::text").get("0") or "0").strip()
        item["bathrooms"] = (response.css("[aria-label='Baths']::text").get("0") or "0").strip()
        item["added_date"] = (
            response.css("span[aria-label='Creation date']::text").get("")
            or response.css("[aria-label='Listing creation date']::text").get("")
        ).strip()

        desc_parts = response.css("[aria-label='Property description'] *::text").getall()
        item["description"] = " ".join(p.strip() for p in desc_parts if p.strip())

        item["amenities"] = [
            a.strip()
            for a in response.css(
                "[aria-label='Amenities'] span::text, [aria-label='Features'] span::text"
            ).getall()
            if a.strip()
        ]

        item["seller_name"] = (
            response.css("[aria-label='Agent name']::text").get("")
            or response.css("[aria-label='Seller name']::text").get("")
        ).strip()
        item["agency_name"] = (
            response.css("[aria-label='Agency info'] div::text").get("")
            or response.css("[aria-label='Agency name']::text").get("")
        ).strip()

        agency_link = response.css(
            "[aria-label='Agency profile']::attr(href), a[title*='Agency']::attr(href)"
        ).get("")
        item["agency_profile_url"] = (
            f"https://www.zameen.com{agency_link}" if agency_link and not agency_link.startswith("http") else agency_link
        )

        external_id = self._extract_external_id(response.url)
        if external_id:
            phone_api_url = (
                f"https://www.zameen.com/api/showNumbers?"
                f"listingExternalID={external_id}&isProject=false"
            )
            yield scrapy.Request(
                url=phone_api_url,
                callback=self.parse_phone,
                cb_kwargs={"item": item},
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Referer": response.url,
                    "X-Requested-With": "XMLHttpRequest",
                },
                errback=self.handle_error,
            )
        else:
            item["phone"] = ""
            item["mobile"] = ""
            yield item

    def parse_phone(self, response, item):
        try:
            data = json.loads(response.text)
            if data.get("success"):
                contact = data.get("contact_details", {})
                phones = contact.get("phone", [])
                item["phone"] = phones[0] if phones else ""
                item["mobile"] = contact.get("mobile", "")
                api_agency = contact.get("agency_name", "")
                if api_agency and not item.get("agency_name"):
                    item["agency_name"] = api_agency
            else:
                item["phone"] = ""
                item["mobile"] = ""
        except Exception as e:
            self.logger.warning(f"[zameen] Phone API error: {e} — status {response.status} — body: '{response.text[:150]}'")
            item["phone"] = ""
            item["mobile"] = ""

        yield item

    # ── Helpers ──────────────────────────────────────────────────────────

    def _extract_listing_id(self, url: str) -> str:
        match = re.search(r"-(\d+-\d+)-\d+\.html$", url)
        return match.group(1) if match else url.split("/")[-1]

    def _extract_external_id(self, url: str) -> str:
        match = re.search(r"-(\d{7,})-\d+-\d+\.html$", url)
        return match.group(1) if match else ""
