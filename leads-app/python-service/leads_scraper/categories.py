"""
Canonical property categories shared across all LEADS scrapers.

Callers (Flask microservice, System 1 hot-trend discovery, System 3
filtered cross-platform matching) should always use these canonical
values — never a platform-specific string like "Homes" or "upper-portion".

Each spider translates a canonical category to its own platform value via
its own CATEGORY_MAP dict. If a platform doesn't support a given canonical
category at all, it's simply absent from that spider's CATEGORY_MAP — the
spider logs a warning and returns no results for that request rather than
guessing at a substitute category.
"""

CANONICAL_CATEGORIES = [
    "house",
    "flat",
    "portion",
    "room",
    "farmhouse",
    "penthouse",
    "residential_plot",
    "commercial_plot",
    "shop",
    "office",
    "warehouse",
    "factory",
    "building",
    "commercial_other",
]
