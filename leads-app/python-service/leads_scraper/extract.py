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
