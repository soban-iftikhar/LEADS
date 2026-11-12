"""Turn one raw portal payload into one listing record (SPEC_01 3.1-3.4).

A record's keys are the portal table's column names, plus:
  _phone      plaintext phone, used only to compute phone_hash / phone_enc, never stored
  _warnings   parse problems worth logging
Field paths come from docs/specs/FIELD_INVENTORY.md.
"""

import hashlib
import re
from datetime import datetime
from decimal import Decimal

from sqids import Sqids

from leads.redact import redact
from leads_scraper import parsing as p

MASTER_REQUIRED = ("price_pkr", "size_sqft", "city", "locality", "category", "url")


def _first(*values):
    for v in values:
        if v not in (None, "", [], {}):
            return v
    return None


def content_hash(rec: dict) -> str:
    parts = [rec.get("price_pkr"), rec.get("size_sqft"), rec.get("title"), rec.get("description")]
    return hashlib.sha256("|".join("" if v is None else str(v) for v in parts).encode()).hexdigest()


def _location(names: list[str], fallback_city: str | None):
    """Empg-style location arrays: [country, province, city, locality, ...]."""
    city = names[2] if len(names) > 2 else fallback_city
    locality = names[3] if len(names) > 3 else None
    text = ", ".join(reversed(names[2:])) if len(names) > 2 else None
    return city, locality, text


def _base(platform: str, ctx: dict, payload: dict) -> dict:
    return {
        "platform": platform,
        "scraped_at": ctx["scraped_at"],
        "raw": redact(payload),
        "_warnings": [],
    }


def _finish(rec: dict, settings) -> dict:
    value, unit = rec.pop("_size_value", None), rec.pop("_size_unit", None)
    rec["size_value"] = value.quantize(Decimal("0.01")) if value is not None else None
    rec["size_unit"] = unit
    rec["size_sqft"] = p.to_sqft(value, unit, settings.marla_sqft, settings.kanal_marla)
    if value is not None and unit is None:
        rec["_warnings"].append(f"unknown size unit in {rec.get('size_raw')!r}")
    if rec.get("price_pkr") is None:
        rec["_warnings"].append("no price")
    for key in ("amenities", "image_urls"):
        rec[key] = [str(x) for x in rec.get(key) or [] if x not in (None, "")]
    for key in ("title", "description", "seller_name", "agency_name", "locality", "location_text", "city"):
        rec[key] = p.clean_text(rec.get(key))
    rec["title"] = rec["title"] or "(untitled)"
    # Some ads carry no street address; fall back to "locality, city" so the row is kept.
    rec["location_text"] = rec["location_text"] or (
        ", ".join(x for x in (rec.get("locality"), rec.get("city")) if x) or None)
    rec["content_hash"] = content_hash(rec)
    return rec


def _listed(rec: dict, raw_value, force_estimated: bool = False):
    listed, precision, ok = p.parse_listed_at(raw_value, rec["scraped_at"])
    if not ok:
        rec["_warnings"].append(f"could not parse listed_at from {raw_value!r}")
    rec["listed_at"] = listed
    rec["listed_at_precision"] = p.ESTIMATED if force_estimated else precision
    rec["added_date_raw"] = None if raw_value in (None, "") else str(raw_value)


def master_rejection(rec: dict) -> str | None:
    """None if the record may enter master.listings, else the reason it may not."""
    missing = [k for k in MASTER_REQUIRED if rec.get(k) in (None, "")]
    if rec.get("size_sqft") is not None and rec["size_sqft"] <= 0:
        missing.append("size_sqft")
    if rec.get("category") and rec["category"] not in CANONICAL:
        missing.append("category")
    return ("missing or invalid: " + ", ".join(dict.fromkeys(missing))) if missing else None


CANONICAL = {
    "house", "flat", "portion", "room", "farmhouse", "penthouse", "residential_plot",
    "commercial_plot", "shop", "office", "warehouse", "factory", "building", "commercial_other",
}


# --- zameen -------------------------------------------------------------------

ZAMEEN_CATEGORY = {
    "Houses_Property": "house", "Flats_Apartments": "flat", "Upper_Portions": "portion",
    "Lower_Portions": "portion", "Rooms": "room", "Farm_Houses": "farmhouse",
    "Penthouse": "penthouse", "Residential_Plots": "residential_plot",
    "Commercial_Plots": "commercial_plot", "Retail_Shops": "shop", "Offices": "office",
    "Warehouses": "warehouse", "Factories": "factory", "Buildings": "building",
}


def normalize_zameen(payload: dict, ctx: dict, settings) -> dict:
    d = payload["detail"]
    numbers = payload.get("show_numbers", {}).get("contact_details") or {}
    rec = _base("zameen", ctx, payload)
    leaf = (d.get("category") or [{}])[-1].get("slug")
    names = [loc.get("name") for loc in d.get("location") or []]
    city, locality, text = _location(names, ctx.get("city"))
    agency = d.get("agency") or {}
    amen = {a.get("slug"): a.get("value") for g in d.get("amenities") or [] for a in g.get("amenities") or []}
    amen_text = [
        f"{a['text']}: {a['value']}" if a.get("value") not in (None, "") else a.get("text")
        for g in d.get("amenities") or [] for a in g.get("amenities") or []
    ]
    area = d.get("area")
    product = d.get("product")

    rec.update({
        "external_id": str(d["externalID"]),
        "url": _first(d.get("link"), ctx.get("url")),
        "title": d.get("title"),
        "category": ZAMEEN_CATEGORY.get(leaf) or ctx.get("category"),
        "purpose": "rent" if d.get("purpose") == "for-rent" else "sale",
        "price_raw": None if d.get("price") is None else str(d.get("price")),
        "price_pkr": None if d.get("hidePrice") else p.parse_price(d.get("price")),
        "size_raw": None if area is None else f"{area} sqm",
        "_size_value": Decimal(str(area)) if area else None,
        "_size_unit": "sqm" if area else None,  # Zameen area is square metres (FIELD_INVENTORY F10)
        "city": city, "locality": locality, "location_text": text,
        "bedrooms": p.parse_int(d.get("rooms"), zero_is_null=True),
        "bathrooms": p.parse_int(d.get("baths"), zero_is_null=True),
        "description": d.get("description"),
        "amenities": amen_text,
        "seller_name": d.get("contactName"),
        "agency_name": _first(agency.get("name"), numbers.get("agency_name")),
        "agency_profile_url": None,
        "is_agency": agency.get("type") == "agency" if agency else None,
        "_phone": _first(*((d.get("phoneNumber") or {}).get("mobileNumbers") or []),
                         d.get("mobilePhoneNumber"), numbers.get("mobile")),
        "latitude": (d.get("geography") or {}).get("lat"),
        "longitude": (d.get("geography") or {}).get("lng"),
        "image_urls": [ph.get("url") for ph in d.get("photos") or []],
        "is_verified": d.get("isVerified"),
        "is_featured": bool(product) and product not in ("free", "default"),
        "product": product,
        "agency_tier": agency.get("product"),
        "agency_since": p.iso_to_dt(agency.get("createdAt")),
        "completion_status": d.get("completionStatus"),
        "built_year": p.parse_int(amen.get("built-in-year")),
        "floors": p.parse_int(amen.get("floors")),
    })
    _listed(rec, d.get("createdAt"))
    return _finish(rec, settings)


# --- olx ----------------------------------------------------------------------

OLX_CATEGORY = {
    "houses": "house", "apartments-flats": "flat", "portions-floors": "portion",
    "rooms": "room", "shops-offices-commercial-space": "commercial_other",
}


def normalize_olx(payload: dict, ctx: dict, settings) -> dict:
    d = payload["detail"]
    contact = ((payload.get("contact_info") or {}).get("body")) or {}
    ef = d.get("extraFields") or {}
    rec = _base("olx", ctx, payload)
    cats = [c.get("slug") for c in d.get("category") or []]
    leaf = cats[-1] if cats else None
    category = OLX_CATEGORY.get(leaf)
    otype = ef.get("type") or ""
    if leaf == "land-plots":
        category = "commercial_plot" if "commercial" in otype else "residential_plot"
    elif leaf == "shops-offices-commercial-space":
        category = next((c for c in ("shop", "office", "building") if c in otype), "commercial_other")
    names = [loc.get("name") for loc in d.get("location") or []]
    city, locality, text = _location(names, ctx.get("city"))
    product = d.get("product")
    rent = "rent" in (cats[0] if cats else "") or d.get("purpose") == "for-rent"
    ext = str(d["externalID"])

    rec.update({
        "external_id": ext,
        "url": f"https://www.olx.com.pk/item/{d['slug']}-iid-{ext}" if d.get("slug") else ctx.get("url"),
        "title": d.get("title"),
        "category": category or ctx.get("category"),
        "purpose": "rent" if rent else "sale",
        "price_raw": None if ef.get("price") is None else str(ef.get("price")),
        "price_pkr": p.parse_price(_first(ef.get("price"), d.get("price"))),
        "size_raw": None if ef.get("ft") is None else f"{ef.get('ft')} {ef.get('ft_unit') or ''}".strip(),
        "city": city, "locality": locality, "location_text": text,
        "bedrooms": p.parse_int(ef.get("rooms"), zero_is_null=True),
        "bathrooms": p.parse_int(ef.get("bathrooms"), zero_is_null=True),
        "description": d.get("description"),
        "amenities": ef.get("features") or [],
        "seller_name": _first(contact.get("name"), (d.get("contactInfo") or {}).get("name")),
        "agency_name": None,
        "agency_profile_url": None,
        "is_agency": None,
        "_phone": _first(*(contact.get("mobileNumbers") or []), contact.get("mobile")),
        "latitude": (d.get("geography") or {}).get("lat"),
        "longitude": (d.get("geography") or {}).get("lng"),
        "image_urls": [],  # OLX payload has photo ids only (FIELD_INVENTORY F14)
        "is_verified": d.get("isSellerVerified"),
        "is_featured": product == "featured" or d.get("virtualState") == "featured",
        "product": product,
        "is_furnished": p.to_bool(ef.get("furnished")),
        "floor_level": p.parse_int(ef.get("floor_level")),
        "portal_expires_at": p.epoch_to_dt(d.get("expiresAt")),
    })
    rec["_size_value"], rec["_size_unit"] = p.parse_size(ef.get("ft"), ef.get("ft_unit"))
    _listed(rec, d.get("createdAt"))
    return _finish(rec, settings)


# --- graana -------------------------------------------------------------------

GRAANA_CATEGORY = {
    "house": "house", "flat": "flat", "upperPortion": "portion", "lowerPortion": "portion",
    "room": "room", "farmHouse": "farmhouse", "pentHouse": "penthouse", "penthouse": "penthouse",
    "residentialPlot": "residential_plot", "commercialPlot": "commercial_plot", "shop": "shop",
    "office": "office", "warehouse": "warehouse", "factory": "factory", "building": "building",
}
GRAANA_FEATURE_GROUPS = ("primaryFeatures", "secondaryFeatures", "utilityFeatures",
                         "communicationFeatures", "nearByFeatures")


def normalize_graana(payload: dict, ctx: dict, settings) -> dict:
    d = payload["detail"]
    rec = _base("graana", ctx, payload)
    agency = d.get("agency") or {}
    amenities = []
    for group in GRAANA_FEATURE_GROUPS:
        for name, value in (d.get(group) or {}).items():
            amenities.append(name if value in (True, None, "") else f"{name}: {value}")
    lat, lng = d.get("lat"), d.get("lng")

    rec.update({
        "external_id": str(d["id"]),
        "url": _first(ctx.get("url"), payload.get("source_url")),
        "title": d.get("customTitle"),
        "category": GRAANA_CATEGORY.get(d.get("subtype")) or ctx.get("category"),
        "purpose": "rent" if d.get("purpose") == "rent" else "sale",
        "price_raw": None if d.get("price") is None else str(d.get("price")),
        "price_pkr": p.parse_price(d.get("price")),
        "size_raw": None if d.get("size") is None else f"{d.get('size')} {d.get('sizeUnit') or ''}".strip(),
        # Graana uses flat dotted keys ("city.name"), not nested objects (FIELD_INVENTORY F13)
        "city": _first(d.get("city.name"), (d.get("city") or {}).get("name"), ctx.get("city")),
        "locality": _first(d.get("area.name"), (d.get("area") or {}).get("name")),
        "location_text": d.get("address"),
        "bedrooms": p.parse_int(d.get("bed"), zero_is_null=True),
        "bathrooms": p.parse_int(d.get("bath"), zero_is_null=True),
        "description": d.get("description"),
        "amenities": amenities,
        "seller_name": d.get("name"),
        "agency_name": agency.get("name"),
        "agency_profile_url": None,
        "is_agency": bool(agency) or bool(d.get("agencyId")),
        "_phone": d.get("phone"),
        "latitude": lat or None,  # 0 means unknown
        "longitude": lng or None,
        "image_urls": [img.get("url") for img in d.get("propertyImages") or [] if img.get("type", "image") == "image"],
        "agency_since": p.iso_to_dt(agency.get("createdAt")),
        "condition": d.get("condition"),
        "portal_expires_at": p.iso_to_dt(d.get("expiresAt")),
    })
    rec["_size_value"], rec["_size_unit"] = p.parse_size(d.get("size"), d.get("sizeUnit"))
    _listed(rec, d.get("createdAt"))
    return _finish(rec, settings)


# --- ilaan --------------------------------------------------------------------

# Ilaan builds its listing links in the browser from the API fields. This is a port of the
# site's own generatePropertySEOUrl / encodePropertyId (Sqids with their alphabet).
_ILAAN_SQIDS = Sqids(alphabet="f7k2xqm9v5jw3n8hytep1gbsz0rlud4oa6ic", min_length=8)
_ILAAN_SECTION = {
    "house": "house", "villa": "house", "flat": "flats", "apartment": "flats", "plot": "plots",
    "land": "plots", "commercial": "commercial", "office": "commercial", "shop": "commercial",
    "warehouse": "commercial", "farmhouse": "farmhouse", "penthouse": "penthouse", "room": "room",
}
_ILAAN_PURPOSE = {"forsale": "sale", "sale": "sale", "forrent": "rent", "rent": "rent"}


def _ilaan_slug(text: str) -> str:
    t = re.sub(r"[^\w\s-]", "", text.lower().strip())
    return re.sub(r"-+", "-", re.sub(r"\s+", "-", t)).strip("-")


def _js_number(value) -> str:
    f = float(value)
    return str(int(f)) if f.is_integer() else repr(f)


def ilaan_url(entry: dict, portal_type: str | None, status: str | None) -> str | None:
    try:
        pid = int(entry.get("propertyId"))
    except (TypeError, ValueError):
        return None
    if pid < 1 or not portal_type:
        return None
    ptype = portal_type.lower().strip()
    purpose = _ILAAN_PURPOSE.get(re.sub(r"\s+", "", (status or "sale").lower()), "sale")
    parts = []
    area, unit = entry.get("landArea"), (entry.get("areaUnitName") or "").lower()
    if area and unit:
        for needle, label in (("marla", "marla"), ("kanal", "kanal"), ("sqft", "sqft"),
                              ("sq ft", "sqft"), ("sqyd", "sqyd"), ("sq yd", "sqyd")):
            if needle in unit:
                parts.append(f"{_js_number(area)}-{label}")
                break
    parts += [ptype, "for", purpose]
    locality = entry.get("localityName")
    if not locality and entry.get("address"):
        pieces = [x.strip() for x in entry["address"].split(",")]
        locality = pieces[0] if len(pieces) > 1 else None
    if locality:
        parts += ["in", _ilaan_slug(locality)]
    if entry.get("cityName"):
        if not locality:
            parts.append("in")
        parts.append(_ilaan_slug(entry["cityName"]))
    section = _ILAAN_SECTION.get(ptype, "property")
    return (f"https://www.ilaan.com/{section}-for-{purpose}/{'-'.join(parts).lower()}"
            f"-pid{_ILAAN_SQIDS.encode([pid])}")


def _ilaan_search(payload: dict) -> tuple[str | None, str | None]:
    """(type, status) the listing was found under: from the spider, or the fixture's source_url."""
    search = payload.get("search") or {}
    if search.get("type"):
        return search.get("type"), search.get("status")
    src = payload.get("source_url") or ""
    t, st = re.search(r"[?&]type=([^&]+)", src), re.search(r"[?&]status=([^&]+)", src)
    return (t.group(1) if t else None), (st.group(1) if st else None)


def normalize_ilaan(payload: dict, ctx: dict, settings) -> dict:
    e = payload["listing"]
    reveal = (payload.get("reveal_contact") or {}).get("body") or {}
    contact = reveal.get("data") or {}
    rec = _base("ilaan", ctx, payload)
    portal_type, status = _ilaan_search(payload)

    rec.update({
        "external_id": str(e["propertyId"]),
        "url": _first(ctx.get("url"), ilaan_url(e, portal_type, status)),
        "title": e.get("heading"),
        "category": ctx.get("category"),
        "purpose": ctx.get("purpose") or "sale",
        "price_raw": None if e.get("price") is None else str(e.get("price")),
        "price_pkr": p.parse_price(e.get("price")),
        "size_raw": None if e.get("landArea") is None else f"{e.get('landArea')} {e.get('areaUnitName') or ''}".strip(),
        "city": _first(e.get("cityName"), ctx.get("city")),
        "locality": _first(e.get("localityName"), e.get("subLocalityName")),
        "location_text": e.get("address"),
        "bedrooms": p.parse_int(e.get("bedroomCount"), zero_is_null=True),
        "bathrooms": p.parse_int(e.get("bathroomCount"), zero_is_null=True),
        "description": e.get("description"),
        "amenities": [],
        "seller_name": e.get("agentName"),
        "agency_name": None,
        "agency_profile_url": None,
        "is_agency": None if e.get("isDirectOwner") is None else not e.get("isDirectOwner"),
        "_phone": _first(contact.get("phone"), contact.get("whatsapp")),
        "latitude": e.get("latitude"),
        "longitude": e.get("longitude"),
        "image_urls": [(e.get("coverImage") or {}).get("fullUrl")],
        "is_verified": e.get("isVerified"),
        "is_featured": e.get("isPremium"),
        "is_gold_verified": e.get("isGoldVerified"),
    })
    rec["_size_value"], rec["_size_unit"] = p.parse_size(e.get("landArea"), e.get("areaUnitName"))
    # Only verifiedDate is set; createDate is null (FIELD_INVENTORY F8).
    _listed(rec, e.get("verifiedDate"), force_estimated=True)
    return _finish(rec, settings)


NORMALIZERS = {
    "zameen": normalize_zameen,
    "olx": normalize_olx,
    "graana": normalize_graana,
    "ilaan": normalize_ilaan,
}


def normalize(platform: str, payload: dict, ctx: dict, settings) -> dict:
    if isinstance(ctx.get("scraped_at"), str):
        ctx = {**ctx, "scraped_at": datetime.fromisoformat(ctx["scraped_at"])}
    return NORMALIZERS[platform](payload, ctx, settings)
