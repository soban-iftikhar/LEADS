"""Build a field inventory from samples/<portal>/*.json.

For every field path: types seen, one example, and fill rate across samples.
A field counts as filled when it is not null, "", [] or {}.

Usage:
    python scripts/field_inventory.py [--portal zameen] [--format md|json]
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent.parent / "samples"
SKIP_TOP = {"captured_at", "source_url", "search_url"}

# Where each field goes. Paths not listed stay in `raw` only.
# "common:<col>" = SPEC_01 3.1/3.2 column, "promote:<col>" = portal-only column (3.3),
# "drop" = removed from raw before storage (personal data, see inventory notes).
USE = {
    "zameen": {
        "detail.externalID": "common:external_id",
        "detail.link": "common:url",
        "detail.title": "common:title",
        "detail.category[].slug": "common:category (leaf)",
        "detail.purpose": "common:purpose",
        "detail.price": "common:price_pkr / price_raw",
        "detail.area": "common:size_* (square metres)",
        "detail.location[].name": "common:city / locality / location_text",
        "detail.createdAt": "common:listed_at (epoch, exact)",
        "detail.rooms": "common:bedrooms (0 -> null)",
        "detail.baths": "common:bathrooms (0 -> null)",
        "detail.description": "common:description",
        "detail.amenities[].amenities[].text": "common:amenities",
        "detail.contactName": "common:seller_name",
        "detail.agency.name": "common:agency_name",
        "detail.agency.type": "common:is_agency",
        "detail.phoneNumber.mobileNumbers[]": "common:phone_hash / phone_enc",
        "detail.mobilePhoneNumber": "common:phone_hash / phone_enc",
        "detail.geography.lat": "common:latitude",
        "detail.geography.lng": "common:longitude",
        "detail.photos[].url": "common:image_urls",
        "detail.isVerified": "promote:is_verified",
        "detail.product": "promote:is_featured + zameen_product",
        "detail.agency.product": "promote:zameen_agency_tier",
        "detail.agency.createdAt": "promote:agency_since",
        "detail.completionStatus": "promote:zameen_completion_status",
        "detail.amenities[].amenities[].value": "promote:built_year, zameen_floors (from slugs)",
        "detail.phoneNumber.phoneNumbers[]": "drop",
        "detail.phoneNumber.whatsapp": "drop",
        "detail.primaryPhoneNumber": "drop",
        "show_numbers.contact_details.mobile": "drop",
        "show_numbers.contact_details.phone[]": "drop",
        "show_numbers.contact_details.fax": "drop",
    },
    "olx": {
        "detail.externalID": "common:external_id",
        "detail.slug": "common:url (build from slug + externalID)",
        "detail.title": "common:title",
        "detail.category[].slug": "common:category (leaf)",
        "detail.purpose": "common:purpose",
        "detail.extraFields.price": "common:price_pkr / price_raw",
        "detail.extraFields.ft": "common:size_value",
        "detail.extraFields.ft_unit": "common:size_unit",
        "detail.location[].name": "common:city / locality / location_text",
        "detail.createdAt": "common:listed_at (epoch, exact)",
        "detail.extraFields.rooms": "common:bedrooms",
        "detail.extraFields.bathrooms": "common:bathrooms",
        "detail.description": "common:description",
        "detail.extraFields.features[]": "common:amenities",
        "contact_info.body.name": "common:seller_name",
        "contact_info.body.mobile": "common:phone_hash / phone_enc",
        "contact_info.body.mobileNumbers[]": "common:phone_hash / phone_enc",
        "detail.geography.lat": "common:latitude",
        "detail.geography.lng": "common:longitude",
        "detail.isSellerVerified": "promote:is_verified",
        "detail.product": "promote:is_featured + olx_product",
        "detail.extraFields.furnished": "promote:is_furnished",
        "detail.extraFields.floor_level": "promote:floor_level",
        "detail.expiresAt": "promote:portal_expires_at",
    },
    "graana": {
        "detail.id": "common:external_id",
        "detail.customTitle": "common:title",
        "detail.subtype": "common:category",
        "detail.purpose": "common:purpose (buy -> sale)",
        "detail.price": "common:price_pkr / price_raw",
        "detail.size": "common:size_value",
        "detail.sizeUnit": "common:size_unit",
        "detail.city.name": "common:city (flat dotted key)",
        "detail.area.name": "common:locality (flat dotted key)",
        "detail.address": "common:location_text",
        "detail.createdAt": "common:listed_at (ISO, exact)",
        "detail.bed": "common:bedrooms",
        "detail.bath": "common:bathrooms",
        "detail.description": "common:description",
        "detail.name": "common:seller_name",
        "detail.agency.name": "common:agency_name / is_agency",
        "detail.phone": "common:phone_hash / phone_enc",
        "detail.lat": "common:latitude (0 -> null)",
        "detail.lng": "common:longitude (0 -> null)",
        "detail.propertyImages[].url": "common:image_urls (relative path)",
        "detail.agency.createdAt": "promote:agency_since",
        "detail.condition": "promote:graana_condition",
        "detail.expiresAt": "promote:portal_expires_at",
        "detail.agency.phone": "drop",
        "detail.agency.email": "drop",
        "detail.agentDetails.phone_number": "drop",
        "detail.agentDetails.custom:phone": "drop",
        "detail.agentDetails.email": "drop",
    },
    "ilaan": {
        "listing.propertyId": "common:external_id",
        "listing.heading": "common:title",
        "listing.price": "common:price_pkr / price_raw",
        "listing.landArea": "common:size_value",
        "listing.areaUnitName": "common:size_unit",
        "listing.cityName": "common:city",
        "listing.localityName": "common:locality",
        "listing.address": "common:location_text",
        "listing.verifiedDate": "common:listed_at (ISO, no timezone)",
        "listing.bedroomCount": "common:bedrooms (0 -> null)",
        "listing.bathroomCount": "common:bathrooms (0 -> null)",
        "listing.description": "common:description",
        "listing.agentName": "common:seller_name",
        "listing.isDirectOwner": "common:is_agency (negated)",
        "listing.coverImage.fullUrl": "common:image_urls (cover only)",
        "listing.isVerified": "promote:is_verified",
        "listing.isPremium": "promote:is_featured",
        "listing.isGoldVerified": "promote:ilaan_is_gold_verified",
        "listing.agentEmail": "drop",
    },
}


def _type(v):
    return {dict: "object", list: "array", str: "string", bool: "bool",
            int: "int", float: "float", type(None): "null"}[type(v)]


def _filled(v):
    return v not in (None, "", [], {})


def flatten(obj, prefix="", out=None):
    """Yield (path, value). Arrays use `[]`; each array element is visited."""
    if out is None:
        out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else k
            out.append((path, v))
            flatten(v, path, out)
    elif isinstance(obj, list):
        for v in obj:
            if isinstance(v, (dict, list)):
                flatten(v, f"{prefix}[]", out)
            else:
                out.append((f"{prefix}[]", v))
    return out


def inventory(portal):
    files = sorted((FIXTURES / portal).glob("*.json"))
    stats = defaultdict(lambda: {"types": set(), "example": None, "filled_in": set()})
    for f in files:
        doc = {k: v for k, v in json.loads(f.read_text()).items() if k not in SKIP_TOP}
        for path, v in flatten(doc):
            s = stats[path]
            s["types"].add(_type(v))
            if _filled(v):
                s["filled_in"].add(f.stem)
                if s["example"] is None and not isinstance(v, (dict, list)):
                    s["example"] = v
    n = len(files)
    rows = []
    for path, s in sorted(stats.items()):
        types = s["types"] - {"null"} or {"null"}
        rows.append({
            "path": path,
            "type": "|".join(sorted(types)) + ("?" if "null" in s["types"] and types != {"null"} else ""),
            "example": s["example"],
            "fill": len(s["filled_in"]),
            "fill_pct": round(100 * len(s["filled_in"]) / n) if n else 0,
        })
    return n, rows


def _cell(v, width=60):
    if v is None:
        return ""
    s = str(v).replace("\n", " ").replace("|", "\\|")
    return (s[: width - 1] + "…") if len(s) > width else s


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--portal", action="append")
    ap.add_argument("--format", choices=["md", "json"], default="md")
    args = ap.parse_args()
    portals = args.portal or sorted(p.name for p in FIXTURES.iterdir() if p.is_dir())
    result = {}
    for portal in portals:
        n, rows = inventory(portal)
        result[portal] = {"samples": n, "fields": rows}
        if args.format == "md":
            print(f"\n### {portal} ({n} samples)\n")
            use = USE.get(portal, {})
            print("| Field path | Type | Example | Fill | Use |")
            print("|---|---|---|---|---|")
            for r in rows:
                print(f"| `{r['path']}` | {r['type']} | {_cell(r['example'], 40)} "
                      f"| {r['fill']}/{n} ({r['fill_pct']}%) | {use.get(r['path'], 'raw')} |")
    if args.format == "json":
        print(json.dumps(result, ensure_ascii=False, indent=1, default=str))
