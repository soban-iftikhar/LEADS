"""Pull the embedded JSON objects portals ship inside their HTML."""

import json
import re

_STATE_RE = re.compile(r"window\.state\s*=\s*")
_NEXT_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def window_state(html: str) -> dict:
    """Zameen and OLX: `window.state = {...}`."""
    m = _STATE_RE.search(html)
    if not m:
        raise ValueError("window.state not found")
    obj, _ = json.JSONDecoder().raw_decode(html, m.end())
    return obj


def next_data(html: str) -> dict:
    """Graana: Next.js `__NEXT_DATA__` script."""
    m = _NEXT_RE.search(html)
    if not m:
        raise ValueError("__NEXT_DATA__ not found")
    return json.loads(m.group(1))


def search_hits(state: dict) -> list[dict]:
    """Zameen / OLX search pages: listing summaries in window.state.algolia.content.hits."""
    try:
        hits = state["algolia"]["content"]["hits"]
    except (KeyError, TypeError):
        return []
    return hits if isinstance(hits, list) else []


def hit_dates(state: dict) -> dict[str, object]:
    """externalID -> newest date the portal shows for it (createdAt, else timestamp)."""
    out = {}
    for h in search_hits(state):
        if isinstance(h, dict) and h.get("externalID") is not None:
            out[str(h["externalID"])] = h.get("createdAt") or h.get("timestamp")
    return out
