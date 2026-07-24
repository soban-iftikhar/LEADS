import re
import json
import scrapy
from itertools import product
from leads_scraper.spiders.base_spider import BaseSpider


class ZameenSpider(BaseSpider):
    name = "zameen"
    platform_name = "zameen"
    allowed_domains = ["zameen.com"]

    CITIES = {
        "Islamabad": 3,
        "Lahore": 2,
        "Karachi": 1,
        "Rawalpindi": 41,
        "Peshawar": 6,
    }

    CATEGORIES = {
        "Homes": "Homes",
        "Plots": "Plots",
        "Flats": "Flats",
        "Commercial": "Commercial",
    }

    PURPOSES = {
        "buy": 1,
        "rent": 2,
    }

    def __init__(self, full_scrape=False, *args, **kwargs):
        super().__init__(full_scrape=full_scrape, *args, **kwargs)
        self.logger.info(
            f"Zameen spider — "
            f"{'FULL SCRAPE' if self.full_scrape else 'DAILY REFRESH'} — "
            f"Max pages: {self.max_pages}"
        )

    # ── Start requests 

    async def start(self):
        if self.full_scrape:
            cities = self.CITIES
            categories = self.CATEGORIES
            purposes = self.PURPOSES
        else:
            cities = {"Islamabad": 3, "Lahore": 2, "Karachi": 1}
            categories = {"Homes": "Homes", "Plots": "Plots"}
            purposes = {"buy": 1}

        for (city_name, city_id), (cat_name, cat_path), (purpose_name, purpose_id) in product(
            cities.items(), categories.items(), purposes.items()
        ):
            url = (
                f"https://www.zameen.com/{cat_path}/"
                f"{city_name}-{city_id}-1.html"
                f"?purpose={purpose_id}"
            )
            yield scrapy.Request(
                url=url,
                callback=self.parse,
                cb_kwargs={
                    "city": city_name,
                    "category": cat_name,
                    "purpose": purpose_name,
                    "page": 1,
                },
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                },
                errback=self.handle_error,
            )

    # ── Level 1: Search results page 

    def parse(self, response, city, category, purpose, page):
        self.logger.info(
            f"[{city}/{category}/{purpose}] Page {page} — {response.url}"
        )

        listings = response.css("li[aria-label='Listing']")
        self.logger.info(f"Found {len(listings)} listings on page {page}")

        if not listings:
            self.logger.warning(
                f"0 listings found — possible block or end: {response.url}"
            )
            return

        for listing in listings:
            link = listing.css(
                "a[aria-label='Listing link']::attr(href)"
            ).get()

            if not link:
                link = listing.css("a::attr(href)").get()

            if not link:
                continue

            detail_url = (
                link if link.startswith("http")
                else f"https://www.zameen.com{link}"
            )

            card_data = self._extract_card_data(listing)

            yield scrapy.Request(
                url=detail_url,
                callback=self.parse_property,
                cb_kwargs={
                    "card_data": card_data,
                    "city": city,
                    "category": category,
                    "purpose": purpose,
                },
                meta={
                    "playwright": True,
                    "playwright_include_page": False,
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                        "timeout": 30000,
                    },
                },
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Fetch-User": "?1",
                    "Referer": response.url,
                },
                errback=self.handle_error,
            )

        # ── Pagination 
        if page < self.max_pages:
            next_url = self._get_next_page(response, page)
            if next_url:
                yield scrapy.Request(
                    url=next_url,
                    callback=self.parse,
                    cb_kwargs={
                        "city": city,
                        "category": category,
                        "purpose": purpose,
                        "page": page + 1,
                    },
                    errback=self.handle_error,
                )

    # ── Card data extraction 

    def _extract_card_data(self, listing) -> dict:
        return {
            "price_card": listing.css(
                "span[aria-label='Price']::text"
            ).get("").strip(),
            "location_card": listing.css(
                "[aria-label='Location']::text"
            ).get("").strip(),
            "size_card": listing.css(
                "[aria-label='Area'] *::text"
            ).get("").strip(),
            "title_card": listing.css(
                "a[aria-label='Listing link']::attr(title)"
            ).get("").strip(),
            "beds_card": listing.css(
                "[aria-label='Beds']::text"
            ).get("").strip(),
            "baths_card": listing.css(
                "[aria-label='Baths']::text"
            ).get("").strip(),
        }

    # ── Pagination helper 

    def _get_next_page(self, response, current_page: int):
        next_link = response.css("a[title='Next']::attr(href)").get()

        if next_link:
            return (
                next_link if next_link.startswith("http")
                else f"https://www.zameen.com{next_link}"
            )

        base_url = response.url.split("?")[0]
        match = re.search(r"-(\d+)(\.html)$", base_url)
        if match:
            next_page = current_page + 1
            next_url = base_url.replace(
                f"-{match.group(1)}{match.group(2)}",
                f"-{next_page}{match.group(2)}"
            )
            if "?" in response.url:
                next_url += "?" + response.url.split("?")[1]
            return next_url

        return None

    # ── Level 2: Property detail page 

    def parse_property(self, response, card_data, city, category, purpose):
        if response.status in (403, 429):
            self.logger.warning(
                f"Blocked [{response.status}]: {response.url}"
            )
            return

        if not response.css("span[aria-label='Price']::text").get() and \
           not response.css("[aria-label='Title']::text").get():
            self.logger.warning(f"Empty page or blocked: {response.url}")
            return

        item = self.build_item(is_project=False)

        item["listing_id"] = self._extract_listing_id(response.url)
        item["url"] = response.url

        item["title"] = (
            response.css("[aria-label='Title']::text").get("")
            or card_data.get("title_card", "")
        ).strip()

        item["location"] = (
            response.css("[aria-label='Property header']::text").get("")
            or response.css(
                "[aria-label='Breadcrumb'] span:last-child::text"
            ).get("")
        ).strip()

        item["city"] = city

        item["locality"] = (
            response.css("span[aria-label='Location']::text").get("")
            or card_data.get("location_card", "")
        ).strip()

        item["price"] = (
            response.css("span[aria-label='Price']::text").get("")
            or card_data.get("price_card", "")
        ).strip()

        item["size"] = (
            response.css("[aria-label='Area'] *::text").get("")
            or card_data.get("size_card", "")
        ).strip()

        item["purpose"] = (
            response.css("span[aria-label='Purpose']::text").get("")
            or purpose
        ).strip()

        item["category"] = (
            response.css("span[aria-label='Type']::text").get("")
            or category
        ).strip()

        item["bedrooms"] = (
            response.css("[aria-label='Beds']::text").get("")
            or card_data.get("beds_card", "0")
        ).strip()

        item["bathrooms"] = (
            response.css("[aria-label='Baths']::text").get("")
            or card_data.get("baths_card", "0")
        ).strip()

        item["added_date"] = (
            response.css(
                "span[aria-label='Creation date']::text"
            ).get("")
            or response.css(
                "[aria-label='Listing creation date']::text"
            ).get("")
        ).strip()

        desc_parts = response.css(
            "[aria-label='Property description'] *::text"
        ).getall()
        item["description"] = " ".join(
            p.strip() for p in desc_parts if p.strip()
        )

        item["amenities"] = [
            a.strip()
            for a in response.css(
                "[aria-label='Amenities'] span::text, "
                "[aria-label='Features'] span::text"
            ).getall()
            if a.strip()
        ]

        item["seller_name"] = (
            response.css("[aria-label='Agent name']::text").get("")
            or response.css("[aria-label='Seller name']::text").get("")
        ).strip()

        item["agency_name"] = (
            response.css(
                "[aria-label='Agency info'] div::text"
            ).get("")
            or response.css(
                "[aria-label='Agency name']::text"
            ).get("")
        ).strip()

        agency_link = response.css(
            "[aria-label='Agency profile']::attr(href), "
            "a[title*='Agency']::attr(href)"
        ).get("")
        item["agency_profile_url"] = (
            f"https://www.zameen.com{agency_link}"
            if agency_link and not agency_link.startswith("http")
            else agency_link
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

    # ── Level 3: Phone API 

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
            self.logger.warning(f"Phone API error: {e}")
            item["phone"] = ""
            item["mobile"] = ""

        yield item

    # ── Helpers 

    def _extract_listing_id(self, url: str) -> str:
        match = re.search(r"-(\d+-\d+)-\d+\.html$", url)
        return match.group(1) if match else url.split("/")[-1]

    def _extract_external_id(self, url: str) -> str:
        match = re.search(r"-(\d{7,})-\d+-\d+\.html$", url)
        return match.group(1) if match else ""