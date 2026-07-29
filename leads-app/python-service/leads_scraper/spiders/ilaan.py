import json
import scrapy
from itertools import product
from leads_scraper.spiders.base_spider import BaseSpider


class IlaanSpider(BaseSpider):
  
    name = "ilaan"
    platform_name = "ilaan"
    allowed_domains = ["ilaan.com", "npi.ilaan.com"]
    API_BASE = "https://npi.ilaan.com/api/properties-new/v2"
    REVEAL_URL = "https://npi.ilaan.com/api/properties-new/{property_id}/reveal-contact?channel=call"

    CATEGORY_MAP = {
        "house": "House",                # confirmed via captured request
        "flat": "Flat",                  # inferred from "flats-for-sale" — unverified
        "residential_plot": "Plot",      # inferred from "plot-for-sale" — unverified
        "commercial_plot": "Plot",       # Ilaan doesn't appear to split plot types either
        "farmhouse": "Farmhouse",        # inferred from "farmhouse-for-sale" — unverified
    }

    STATUS_MAP = {
        "sale": "ForSale",   # confirmed
        "rent": "ForRent",   # inferred, not captured directly
    }

    PAGE_SIZE = 20

    # ── Request resolution (targeted vs general) ────────────────────────

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

        for (canon_cat, api_type), (purpose_name, status) in product(categories.items(), purposes.items()):
            yield self._listing_request(canon_cat, purpose_name, api_type, status, page=1)

    def _listing_request(self, canonical_category, purpose_name, api_type, status, page):
        url = (
            f"{self.API_BASE}?page={page}&pageSize={self.PAGE_SIZE}"
            f"&type={api_type}&status={status}&areaUnit=Marla&verified=true"
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
            },
            headers={"Accept": "application/json"},
            errback=self.handle_error,
        )

    # ── Listing page (JSON API) ─────────────────────────────────────────

    def parse_listing_page(self, response, canonical_category, purpose_name, api_type, status, page):
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

        for entry in items:
            if not self.should_dispatch():
                return

            if self.city and (entry.get("cityName") or "").lower() != self.city.lower():
                continue  # client-side city filter — see class docstring

            item = self._build_item_from_entry(entry, canonical_category, purpose_name)

            self.dispatched += 1
            yield scrapy.Request(
                url=self.REVEAL_URL.format(property_id=entry["propertyId"]),
                method="POST",
                callback=self.reveal_contact,
                cb_kwargs={"item": item},
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                body=b"{}",  # see class docstring — unconfirmed, reasonable default
                errback=self.handle_error,
            )

        pagination = outer.get("pagination", {})
        if self.should_dispatch() and pagination.get("hasMore") and pagination.get("nextPage"):
            yield self._listing_request(
                canonical_category, purpose_name, api_type, status, page=pagination["nextPage"]
            )

    def _build_item_from_entry(self, entry, canonical_category, purpose_name):
        land_area = entry.get("landArea")
        area_unit = entry.get("areaUnitName") or ""
        size = f"{land_area} {area_unit}".strip() if land_area is not None else ""

        amenities = []
        if entry.get("isDirectOwner"):
            amenities.append("Direct Owner")
        if entry.get("isGoldVerified"):
            amenities.append("Gold Verified")
        if entry.get("isVerified"):
            amenities.append("Verified")

        return self.build_item(
            listing_id=str(entry.get("propertyId", "")),
            url="",  # no confirmed public detail-page URL pattern yet
            title=entry.get("heading", ""),
            price=str(entry.get("price", "")),
            city=entry.get("cityName", ""),
            locality=entry.get("address", ""),
            location=entry.get("address", ""),
            category=canonical_category,
            purpose=purpose_name,
            description=entry.get("description", ""),
            seller_name=entry.get("agentName", ""),
            agency_name="" if entry.get("isDirectOwner") else (entry.get("creatorType") or ""),
            agency_profile_url="",
            phone="",   # filled in by reveal_contact — listing-level agentPhone is masked
            mobile="",
            bedrooms=str(entry.get("bedroomCount", "") or ""),
            bathrooms=str(entry.get("bathroomCount", "") or ""),
            size=size,
            added_date=entry.get("verifiedDate", "") or "",
            amenities=amenities,
            is_project=False,
        )

    # ── Reveal contact ───────────────────────────────────────────────

    def reveal_contact(self, response, item):
        try:
            payload = json.loads(response.text)
        except Exception as e:
            self.logger.warning(f"[ilaan] reveal-contact parse error: {e} — body: '{response.text[:200]}'")
            yield item
            return

        contact = payload.get("data") or {}
        phone = contact.get("phone", "")
        whatsapp = contact.get("whatsapp", "")

        if not phone and not whatsapp:
            self.logger.warning(f"[ilaan] reveal-contact returned no phone/whatsapp — body: {payload}")

        item["phone"] = phone or whatsapp
        item["mobile"] = whatsapp or phone

        yield item