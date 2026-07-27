import re
import json
import scrapy
from itertools import product
from leads_scraper.spiders.base_spider import BaseSpider


class OLXSpider(BaseSpider):
    name            = "olx"
    platform_name   = "olx"
    allowed_domains = ["olx.com.pk"]

    BASE_URL = "https://www.olx.com.pk"

    CITIES = [
        "islamabad", "lahore", "karachi",
        "rawalpindi", "peshawar", "faisalabad",
    ]

    CATEGORIES = {
        "/houses_c1721/":                                                            "Houses",
        "/apartments-flats_c1725/":                                                  "Apartments",
        "/portions-floors_c41/":                                                     "Portions",
        "/shops-offices-commercial-space_c1733/?filter=type_eq_shop-sale":           "Shop",
        "/residential-plots-land-plots_c40/?filter=type_eq_residential-plots-sale":  "Residential Plot",
        "/commercial-plots-land-plots_c40/?filter=type_eq_commercial-plots-sale":    "Commercial Plot",
        "/shops-offices-commercial-space_c1733/?filter=type_eq_building-sale":       "Building",
        "/shops-offices-commercial-space_c1733/?filter=type_eq_office-sale":         "Office",
    }

    def __init__(self, full_scrape=False, *args, **kwargs):
        # Aligns perfectly with Zameen's initialization pipeline
        super().__init__(full_scrape=full_scrape, *args, **kwargs)

        # Initialized to None; dynamically bound via from_crawler to prevent AttributeError
        self.access_token = None
        self.id_token = None
        self.refresh_token = None

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        """Standardized Scrapy hook to inject settings safely after instantiation."""
        spider = super().from_crawler(crawler, *args, **kwargs)
        spider.access_token = crawler.settings.get("OLX_ACCESS_TOKEN")
        spider.id_token = crawler.settings.get("OLX_ID_TOKEN")
        spider.refresh_token = crawler.settings.get("OLX_REFRESH_TOKEN")

        spider.logger.info("OLX Spider successfully synchronized with isolated environment context.")
        return spider

    # ── Start Requests (Matrix Loop Pattern) 

    async def start(self):
        if self.full_scrape:
            cities = self.CITIES
            categories = self.CATEGORIES
        else:
            cities = ["islamabad", "lahore", "karachi"]
            categories = {
                "/houses_c1721/": "Houses",
                "/apartments-flats_c1725/": "Apartments and Flats"
            }

        for city, (cat_path, cat_name) in product(cities, categories.items()):
            separator = "&" if "?" in cat_path else "?"
            url = f"{self.BASE_URL}{cat_path}{separator}location={city}"

            yield scrapy.Request(
                url=url,
                callback=self.parse_listing_page,
                cb_kwargs={
                    "city":     city.title(),
                    "category": cat_name,
                    "page":     1,
                },
                errback=self.handle_error,
            )

    # ── Listing Page 

    def parse_listing_page(self, response, city, category, page):
        self.logger.info(f"[OLX] {city}/{category} page {page} — {response.url}")

        cards = response.css("li[aria-label='Listing']")

        if not cards:
            self.logger.warning(f"[OLX] 0 listing cards discovered on target page: {response.url}")
            return

        for card in cards:
            href = card.css("a[title]::attr(href)").get("")
            if not href:
                continue
            url = href if href.startswith("http") else self.BASE_URL + href

            card_data = self._extract_card_data(card)

            yield scrapy.Request(
                url=url,
                callback=self.parse_detail,
                cb_kwargs={
                    "city":      city,
                    "category":  category,
                    "card_data": card_data,
                },
                errback=self.handle_error,
            )

        # Pagination
        if page < self.max_pages:
            next_url = response.css("a[aria-label='Next page']::attr(href), a[data-aut-id='btnNextPage']::attr(href)").get()
            if next_url:
                if not next_url.startswith("http"):
                    next_url = self.BASE_URL + next_url
                yield scrapy.Request(
                    url=next_url,
                    callback=self.parse_listing_page,
                    cb_kwargs={
                        "city":     city,
                        "category": category,
                        "page":     page + 1,
                    },
                    errback=self.handle_error,
                )

    # ── Card Data Extraction 

    def _extract_card_data(self, card) -> dict:
        return {
            "title_card":     card.css("a[title]::attr(title)").get("").strip(),
            "price_card":     self._extract_price_text(card),
            "location_card":  self._extract_locality_text(card),
            "size_card":       card.css("span[aria-label='Area'] span::text").get("").strip(),
            "beds_card":       card.css("span[aria-label='Beds'] span::text").get("").strip(),
            "baths_card":      card.css("span[aria-label='Bathrooms'] span::text").get("").strip(),
            "added_date_card": card.css("span[aria-label='Creation date']::text").get("").strip(),
        }

    # ── Detail Page 

    def parse_detail(self, response, city, category, card_data):
        if response.status in (403, 429):
            self.logger.warning(f"[OLX] Access blocked [{response.status}]: {response.url}")
            return

        listing_id = self._extract_id(response.url)

        title      = response.css("h1::text").get("").strip() or card_data["title_card"]
        price      = self._extract_price_text(response) or card_data["price_card"]
        locality   = self._extract_locality_text(response) or card_data["location_card"]
        size       = (response.css("span[aria-label='Area'] span::text").get("") or card_data["size_card"]).strip()
        bedrooms   = (response.css("span[aria-label='Beds'] span::text").get("") or card_data["beds_card"]).strip()
        bathrooms  = (response.css("span[aria-label='Bathrooms'] span::text").get("") or card_data["baths_card"]).strip()
        added_date = (response.css("span[aria-label='Creation date']::text").get("") or card_data["added_date_card"]).strip()

        desc_parts  = response.css("[itemprop='description'] *::text, section[aria-label='Description'] *::text").getall()
        description = " ".join(p.strip() for p in desc_parts if p.strip())


        seller_name = response.xpath(
            "//span[normalize-space(text())='Posted by']/following-sibling::div[1]//span/text()"
        ).get("").strip()

        item = self.build_item(
            listing_id        = listing_id,
            url               = response.url,
            title             = title,
            price             = price,
            city              = city,
            locality          = locality,
            location          = locality,
            category          = category,
            purpose           = "buy",
            description       = description,
            seller_name       = seller_name,
            agency_name       = "",
            agency_profile_url= "",
            phone             = "",
            mobile            = "",
            bedrooms          = bedrooms,
            bathrooms         = bathrooms,
            size              = size,
            added_date        = added_date,
            amenities         = [],
            is_project        = False,
        )

        if self.access_token:
            contact_url = f"https://www.olx.com.pk/api/listing/{listing_id}/contactInfo/"
            yield scrapy.Request(
                url=contact_url,
                callback=self.parse_contact_info,
                cb_kwargs={"item": item},
                headers={
                    "Accept": "application/json",
                    "Referer": response.url,
                    "X-Requested-With": "XMLHttpRequest",
                },
                cookies={
                    "kc_access_token": self.access_token,
                    "kc_id_token": self.id_token,
                },
                errback=self.handle_error,
            )
        else:
            yield item

    # ── Contact Info API 

    def parse_contact_info(self, response, item):
        try:
            data = json.loads(response.text)
            item["seller_name"] = data.get("name", "") or item.get("seller_name", "")
            mobile_numbers = data.get("mobileNumbers") or []
            item["mobile"] = mobile_numbers[0] if mobile_numbers else data.get("mobile", "")
            item["phone"] = item["mobile"]
        except Exception as e:
            self.logger.warning(f"[OLX] contactInfo parse error: {e}")
            item["seller_name"] = item.get("seller_name", "")
            item["mobile"] = ""
            item["phone"] = ""

        yield item

    # ── Core Parsing Helpers 

    def _extract_price_text(self, selector) -> str:
        for text in selector.css("span::text, div::text").getall():
            t     = text.strip()
            lower = t.lower()
            if (lower.startswith("rs") or "crore" in lower or "lakh" in lower or "pkr" in lower):
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