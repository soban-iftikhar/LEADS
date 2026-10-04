import re
from itertools import product

import scrapy

from leads_scraper.extract import hit_dates, window_state
from leads_scraper.spiders.base_spider import BaseSpider


class ZameenSpider(BaseSpider):
    name = "zameen"
    platform_name = "zameen"
    allowed_domains = ["zameen.com"]

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

    # Zameen ignores purpose=2 (it returns sale listings), and no rent URL has been
    # confirmed yet, so Zameen is crawled for sale only.
    PURPOSE_IDS = {"sale": 1}

    HEADERS = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    # Request resolution (targeted vs general)

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
        cities = dict(self.cities())
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

    # Level 1: Search results page

    def parse(self, response, page, city_name, canonical_category, purpose_name):
        self.logger.info(f"[zameen] [{city_name}/{canonical_category}/{purpose_name}] page {page} — {response.url}")

        self.pages_fetched += 1
        listings = response.css("li[aria-label='Listing']")
        if not listings:
            self.logger.warning(f"[zameen] 0 listings: {response.url}")
            return

        # The search page lists a date per listing when its embedded state is present;
        # old ones are skipped without opening their detail page.
        try:
            dates = hit_dates(window_state(response.text))
        except ValueError:
            dates = {}

        fresh = 0
        for listing in listings:
            if not self.should_dispatch():
                return
            link = listing.css("a[aria-label='Listing link']::attr(href)").get()
            if not link:
                link = listing.css("a::attr(href)").get()
            if not link:
                continue
            detail_url = link if link.startswith("http") else f"https://www.zameen.com{link}"
            ext = self._extract_external_id(detail_url)
            if ext in dates and not self.is_fresh(dates[ext]):
                continue
            fresh += 1

            self.dispatched += 1
            yield scrapy.Request(
                url=detail_url,
                callback=self.parse_property,
                cb_kwargs={
                    "city_name": city_name,
                    "canonical_category": canonical_category,
                    "purpose_name": purpose_name,
                },
                headers={**self.HEADERS, "Referer": response.url},
                errback=self.handle_error,
            )

        if self.keep_paging(fresh, page):
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

    # Level 2: Property detail page

    def parse_property(self, response, city_name, canonical_category, purpose_name):
        if self.max_records is not None and self.records_collected >= self.max_records:
            return
        if response.status in (403, 429):
            self.logger.warning(f"[zameen] Blocked [{response.status}]: {response.url}")
            return
        try:
            detail = window_state(response.text)["property"]["data"]
        except (ValueError, KeyError, TypeError) as e:
            self.logger.warning(f"[zameen] no listing data ({e}): {response.url}")
            self.errors.append({"url": response.url, "error": f"no listing data: {e}"})
            return
        if not self.is_fresh(detail.get("createdAt")):
            return
        # Phones are already in the detail payload, so the showNumbers call is skipped.
        yield self.raw_item(
            {"detail": detail},
            category=canonical_category, purpose=purpose_name, city=city_name, url=response.url,
        )

    # Helpers

    def _extract_external_id(self, url: str) -> str:
        """.../some_title-54827763-3118-1.html -> 54827763"""
        match = re.search(r"-(\d{6,})-\d+-\d+\.html", url)
        return match.group(1) if match else ""
