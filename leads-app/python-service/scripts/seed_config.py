#!/usr/bin/env python3
"""Seed the config schema: regions, localities, portals, city mappings, package plans (idempotent).

City ids below were read off each portal's own city URLs on 10 Nov 2026:
  zameen  /Homes/Islamabad-3-1.html            Rawalpindi-41
  olx     /islamabad_g4060615/houses_c1721     /rawalpindi_g4060681/...
  graana  /sale/house-sale-islamabad-1/        /sale/house-sale-rawalpindi-3/
  ilaan   properties-new/v2?cityId=3           cityId=10
To add a city later, insert rows here or from the admin dashboard; no spider changes.
Rows that already exist are left alone, so values changed from the admin dashboard survive a re-run.

Usage: python scripts/seed_config.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from leads.db import close_pool, get_pool  # noqa: E402

REGIONS = [("Islamabad", "islamabad", True), ("Rawalpindi", "rawalpindi", True)]
PORTALS = [  # slug, name, requests per minute
    ("zameen", "Zameen", 15),
    ("olx", "OLX", 15),
    ("graana", "Graana", 6),
    ("ilaan", "Ilaan", 15),
]
# region slug -> (name, slug, parent slug or None). Parents are listed before their children.
LOCALITIES = {
    "islamabad": [
        ("G-13", "g-13", None), ("G-13/1", "g-13-1", "g-13"), ("G-13/2", "g-13-2", "g-13"),
        ("G-13/3", "g-13-3", "g-13"), ("G-13/4", "g-13-4", "g-13"),
        ("G-14", "g-14", None), ("G-14/4", "g-14-4", "g-14"),
        ("G-11", "g-11", None), ("F-11", "f-11", None), ("F-11/1", "f-11-1", "f-11"),
        ("E-11", "e-11", None), ("I-8", "i-8", None), ("B-17", "b-17", None),
        ("DHA", "dha", None), ("DHA Phase 2", "dha-phase-2", "dha"),
    ],
    "rawalpindi": [
        ("Bahria Town", "bahria-town", None), ("Bahria Town Phase 7", "bahria-town-phase-7", "bahria-town"),
        ("Bahria Town Phase 8", "bahria-town-phase-8", "bahria-town"),
        ("Gulraiz", "gulraiz", None), ("Satellite Town", "satellite-town", None),
        ("Adiala Road", "adiala-road", None), ("Saddar", "saddar", None),
        ("Chaklala Scheme 3", "chaklala-scheme-3", None),
    ],
}
# name, lead count, price (PKR), delivery days, sort order. Starting values (OQ-15); the admin edits them.
PLANS = [("Starter", 25, 12_500, 60, 1), ("Growth", 100, 40_000, 60, 2), ("Pro", 250, 87_500, 60, 3)]
MAPS = {  # portal -> region slug -> external city id
    "zameen": {"islamabad": "3", "rawalpindi": "41"},
    "olx": {"islamabad": "islamabad_g4060615", "rawalpindi": "rawalpindi_g4060681"},
    "graana": {"islamabad": "islamabad-1", "rawalpindi": "rawalpindi-3"},
    "ilaan": {"islamabad": "3", "rawalpindi": "10"},
}


def main():
    with get_pool().connection() as conn, conn.transaction():
        for name, slug, active in REGIONS:
            conn.execute(
                "INSERT INTO config.regions (name, slug, active) VALUES (%s, %s, %s) "
                "ON CONFLICT (slug) DO NOTHING", (name, slug, active))
        for slug, name, rpm in PORTALS:
            conn.execute(
                "INSERT INTO config.portals (slug, name, requests_per_minute) VALUES (%s, %s, %s) "
                "ON CONFLICT (slug) DO NOTHING", (slug, name, rpm))
        for portal, cities in MAPS.items():
            for region, ext in cities.items():
                conn.execute(
                    """INSERT INTO config.portal_region_maps (portal_id, region_id, external_city_id)
                       SELECT p.id, r.id, %s FROM config.portals p, config.regions r
                       WHERE p.slug = %s AND r.slug = %s
                       ON CONFLICT (portal_id, region_id) DO NOTHING""", (ext, portal, region))
        for region, rows in LOCALITIES.items():
            for name, slug, parent in rows:
                conn.execute(
                    """INSERT INTO config.localities (region_id, name, slug, aliases, parent_id)
                       SELECT r.id, %s, %s, '{}',
                              (SELECT l.id FROM config.localities l WHERE l.region_id = r.id AND l.slug = %s)
                       FROM config.regions r WHERE r.slug = %s
                       ON CONFLICT (region_id, slug) DO NOTHING""", (name, slug, parent, region))
        for name, leads, price, days, order in PLANS:
            conn.execute(
                """INSERT INTO config.package_plans (name, lead_count, price_pkr, delivery_days, sort_order)
                   SELECT %s, %s, %s, %s, %s
                   WHERE NOT EXISTS (SELECT 1 FROM config.package_plans WHERE name = %s)""",
                (name, leads, price, days, order, name))
        counts = conn.execute(
            """SELECT (SELECT count(*) FROM config.portal_region_maps),
                      (SELECT count(*) FROM config.localities),
                      (SELECT count(*) FROM config.package_plans)""").fetchone()
    print(f"config seeded: {counts[0]} portal/city mappings, {counts[1]} localities, {counts[2]} package plans")
    close_pool()


if __name__ == "__main__":
    main()
