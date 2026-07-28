import re
import scrapy
from itertools import product
from scrapy_playwright.page import PageMethod
from leads_scraper.spiders.base_spider import BaseSpider


class GraanaSpider(BaseSpider):
    name            = "graana"
    platform_name   = "graana"
    allowed_domains = ["graana.com"]

    BASE_URL = "https://www.graana.com"

    # ── Stable category slugs ────────────────────────────────────────────────
    # These are path-based, not hash-based — stable across deployments
    CATEGORIES = {
        "house":       "Houses",
        "flat":        "Flats",
        "upper-portion": "Portions",
        "room":        "Rooms",
        "farm-house":  "Farmhouse",
        "pent-house":  "Penthouse",
        "plot":        "Plot",
        "commercial":  "Commercial",
        "shop":        "Shop",
        "office":      "Office",
        "warehouse":   "Warehouse",
        "factory":     "Factory",
        "building":    "Building",
    }

    CITIES = [
        "Islamabad",
        "Lahore",
        "Karachi",
        "Rawalpindi",
        "Peshawar",
        "Faisalabad",
    ]

    PURPOSE_MAP = {
        "sale": "buy",
        "rent": "rent",
    }

    PAGE_SIZE = 30

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_pages = 999 if self.full_scrape else 3

    # ── Start requests ────────────────────────────────────────────────────────

    def start_requests(self):
        purposes = ["sale", "rent"] if self.full_scrape else ["sale"]
        cities   = self.CITIES if self.full_scrape else ["Islamabad", "Lahore", "Karachi"]
        cats     = self.CATEGORIES if self.full_scrape else {
            "house": "Houses",
            "flat":  "Flats",
            "plot":  "Plot",
            "shop":  "Shop",
        }

        for purpose, (cat_slug, cat_name), city in product(
            purposes, cats.items(), cities
        ):
            url = (
                f"{self.BASE_URL}/{purpose}/"
                f"{cat_slug}-{purpose}-{city}-1/"
                f"?pageSize={self.PAGE_SIZE}&page=1"
            )
            yield scrapy.Request(
                url=url,
                callback=self.parse_listing_page,
                cb_kwargs={
                    "category":   cat_name,
                    "cat_slug":   cat_slug,
                    "city":       city,
                    "purpose":    self.PURPOSE_MAP[purpose],
                    "purpose_str":purpose,
                    "page":       1,
                },
                errback=self.handle_error,
            )

    # ── Listing page ────────────────────────────────────────────────

    def parse_listing_page(self, response, category, cat_slug, city,
                           purpose, purpose_str, page):
        self.logger.info(
            f"[Graana] {city}/{category}/{purpose_str} "
            f"page {page} — {response.url}"
        )

        # ── SELECTOR HEALTH CHECK ────────────────────────────────────────────
        # Graana is Next.js — HTML is SSR so Scrapy can parse it.
        # We use aria-label and semantic tags where possible.
        # MUI hash classes (mui-style-xxx) are used ONLY as fallbacks
        # and are monitored via the health check below.

        cards = response.css("a[href*='/property/']")

        if not cards:
            self.logger.warning(
                f"[Graana] No listing links found — "
                f"possible block or structure change — {response.url}"
            )
            return

        # deduplicate hrefs (same link appears twice per card: image + text)
        seen_hrefs = set()
        for card in cards:
            href = card.attrib.get("href", "")
            if not href or href in seen_hrefs:
                continue
            if "/property/" not in href:
                continue
            seen_hrefs.add(href)

            detail_url = (
                href if href.startswith("http")
                else self.BASE_URL + href
            )

            # ── Card-level data (fallback if detail page fails) ───────────
            card_price    = self._extract_price_from_card(card)
            card_location = card.css("h5::text").get("").strip()
            card_type     = card.css(
                "div.MuiTypography-body2New::text"
            ).get("").strip()
            card_date     = card.css(
                "div.MuiTypography-captionNew::text"
            ).get("").strip()

            yield scrapy.Request(
                url=detail_url,
                callback=self.parse_detail,
                cb_kwargs={
                    "category":   category,
                    "city":       city,
                    "purpose":    purpose,
                    "card_data": {
                        "price":    card_price,
                        "location": card_location,
                        "type":     card_type,
                        "date":     card_date,
                    },
                },
                errback=self.handle_error,
            )

        # ── Pagination ───────────────────────────────────────────────────────
        if page < self.max_pages:
            next_page = page + 1
            next_url  = (
                f"{self.BASE_URL}/{purpose_str}/"
                f"{cat_slug}-{purpose_str}-{city}-1/"
                f"?pageSize={self.PAGE_SIZE}&page={next_page}"
            )
            # stop if current page returned fewer cards than page size
            # (means we've hit the last page)
            if len(seen_hrefs) >= self.PAGE_SIZE:
                yield scrapy.Request(
                    url=next_url,
                    callback=self.parse_listing_page,
                    cb_kwargs={
                        "category":    category,
                        "cat_slug":    cat_slug,
                        "city":        city,
                        "purpose":     purpose,
                        "purpose_str": purpose_str,
                        "page":        next_page,
                    },
                    errback=self.handle_error,
                )

    # ── Detail page ─────────────────────────────────────────────────

    def parse_detail(self, response, category, city, purpose, card_data):
        if response.status in (403, 429):
            self.logger.warning(
                f"[Graana] Blocked {response.status}: {response.url}"
            )
            self.records_rejected += 1
            return

        listing_id = self._extract_id(response.url)

        # ── Price ─────────────────────────────────────────────────────────────
        # Stable: price text is always "PKR" + value — find spans with Crore/Lakh
        price = (
            self._extract_price_from_page(response)
            or card_data["price"]
        )

        # ── Specs (beds, baths, area) ─────────────────────────────────────────
        # Container: div.mui-style-gkl3pv — each holds an icon + a value
        # We read values by position: 0=beds, 1=baths, 2=area
        spec_values = response.css(
            "div.mui-style-gkl3pv div.MuiTypography-subtitle2New::text"
        ).getall()

        bedrooms  = spec_values[0].strip() if len(spec_values) > 0 else ""
        bathrooms = spec_values[1].strip() if len(spec_values) > 1 else ""
        size      = spec_values[2].strip() if len(spec_values) > 2 else ""

        # ── Category ──────────────────────────────────────────────────────────
        # Stable class: mui-style-1d3e9wz contains the property type text
        prop_type = (
            response.css("div.mui-style-1d3e9wz::text").get("").strip()
            or card_data["type"]
            or category
        )

        # ── Location / title ──────────────────────────────────────────────────
        # h5 is the most semantic tag on Graana listing pages
        location = (
            response.css("h5::text").get("").strip()
            or card_data["location"]
        )

        # ── Title: build from URL slug ─────────────────────────────────────────
        # e.g. "1100-sqft-flat-sale-gulberg-greens-islamabad-1547744"
        # → "1100 sqft flat sale gulberg greens islamabad"
        slug  = response.url.rstrip("/").split("/")[-1]
        title = re.sub(r"-\d+$", "", slug).replace("-", " ").title()

        # ── Description ───────────────────────────────────────────────────────
        desc_parts = response.css(
            "[class*='description'] p::text, "
            "[class*='Description'] p::text, "
            "section p::text"
        ).getall()
        description = " ".join(p.strip() for p in desc_parts if p.strip())

        # ── Seller name ───────────────────────────────────────────────────────
        seller_name = response.css(
            "[class*='agentName']::text, "
            "[class*='agent-name']::text, "
            "[class*='sellerName']::text, "
            "h6::text"
        ).get("").strip()

        # ── Added date ────────────────────────────────────────────────────────
        added_date = (
            response.css("div.mui-style-layoxhv::text").get("").strip()
            or card_data["date"]
        )

        # ── Agency name ───────────────────────────────────────────────────────
        agency_name = response.css(
            "[class*='agencyName']::text, "
            "[class*='agency-name']::text"
        ).get("").strip()

        item = self.build_item(
            listing_id        = listing_id,
            url               = response.url,
            title             = title,
            price             = price,
            city              = city,
            locality          = location,
            location          = location,
            category          = prop_type or category,
            purpose           = purpose,
            description       = description,
            seller_name       = seller_name,
            agency_name       = agency_name,
            agency_profile_url= "",
            phone             = "",    # filled by Playwright step below
            mobile            = "",
            bedrooms          = bedrooms,
            bathrooms         = bathrooms,
            size              = size,
            added_date        = added_date,
            amenities         = self._extract_amenities(response),
            is_project        = False,
        )

        # ── Phone via Playwright ──────────────────────────────────────────────
        yield scrapy.Request(
            url=response.url,
            callback=self.extract_phone,
            cb_kwargs={"item": item},
            meta={
                "playwright":              True,
                "playwright_include_page": True,
                "playwright_page_goto_kwargs": {
                    "wait_until": "domcontentloaded",
                    "timeout":    30000,
                },
            },
            dont_filter=True,   # same URL, different callback
            errback=self.handle_error,
        )

    # ── Level 3: Playwright phone extraction ─────────────────────────────────

    async def extract_phone(self, response, item):
        page = response.meta["playwright_page"]
        try:
            # click the Call button — aria-label or text content
            call_btn = page.locator(
                "text=Call, "
                "button:has-text('Call'), "
                "[aria-label='Call']"
            ).first
            await call_btn.wait_for(timeout=8000)
            await call_btn.click()

            # modal loads — wait for the tel: link
            await page.wait_for_selector(
                "a[href^='tel:']", timeout=6000
            )

            # extract from href (most reliable — no text parsing needed)
            tel_link = await page.locator(
                "a[href^='tel:']"
            ).first.get_attribute("href", timeout=4000)

            if tel_link:
                phone = tel_link.replace("tel:", "").strip()
                item["phone"] = phone
                self.logger.info(
                    f"[Graana] Phone: {phone} — {item['url']}"
                )
            else:
                # fallback: read button text
                btn_text = await page.locator(
                    "#callButton"
                ).first.text_content(timeout=3000)
                if btn_text:
                    item["phone"] = btn_text.strip()

        except Exception as e:
            self.logger.warning(
                f"[Graana] Phone extraction failed: {e} — {item['url']}"
            )
        finally:
            await page.close()

        yield item

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _extract_price_from_card(self, card) -> str:
        """
        Find price text from a card element.
        Graana shows "PKR" in one div and "1.9 Crore" in another.
        We look for any text containing Crore or Lakh.
        """
        for text in card.css("*::text").getall():
            t = text.strip()
            lower = t.lower()
            if "crore" in lower or "lakh" in lower or "lac" in lower:
                return t
        return ""

    def _extract_price_from_page(self, response) -> str:
        """
        Full page price extraction — more reliable than card-level.
        span.mui-style-1k6ms13 holds the price value on detail pages.
        We also search for any span/div with Crore/Lakh as fallback.
        """
        # try the stable class first
        price = response.css("span.mui-style-1k6ms13::text").get("").strip()
        if price:
            return price

        # content-based fallback — stable regardless of class changes
        for text in response.css("span::text, div::text").getall():
            t = text.strip()
            lower = t.lower()
            if "crore" in lower or "lakh" in lower or "lac" in lower:
                return t
        return ""

    def _extract_amenities(self, response) -> list:
        """
        Extract amenity / feature tags from the detail page.
        Graana lists amenities in chip/badge components.
        """
        amenities = []
        for text in response.css(
            "[class*='amenity'] *::text, "
            "[class*='feature'] span::text, "
            "[class*='Chip'] span::text"
        ).getall():
            t = text.strip()
            if t and len(t) > 1:
                amenities.append(t)
        return list(set(amenities))  # deduplicate

    def _extract_id(self, url: str) -> str:
        """
        Graana listing IDs are the numeric suffix at the end of the slug.
        e.g. /property/1100-sqft-flat-sale-gulberg-greens-islamabad-1547744/
        → 1547744
        """
        match = re.search(r"-(\d{5,})/?$", url.rstrip("/"))
