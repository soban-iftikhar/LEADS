#!/usr/bin/env python3
"""Seed config.regions, config.portals and config.portal_region_maps (idempotent).

City ids below were read off each portal's own city URLs on 10 Nov 2026:
  zameen  /Homes/Islamabad-3-1.html            Rawalpindi-41
  olx     /islamabad_g4060615/houses_c1721     /rawalpindi_g4060681/...
  graana  /sale/house-sale-islamabad-1/        /sale/house-sale-rawalpindi-3/
  ilaan   properties-new/v2?cityId=3           cityId=10
To add a city later, insert rows here or from the admin dashboard; no spider changes.

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
        n = conn.execute("SELECT count(*) FROM config.portal_region_maps").fetchone()[0]
    print(f"config seeded: {n} portal/city mappings")
    close_pool()


if __name__ == "__main__":
    main()
