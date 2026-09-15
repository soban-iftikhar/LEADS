"""Remove phone numbers and emails from raw portal payloads before storage.

Plaintext phones are never persisted (rule 6), including inside `raw jsonb`.
"""

import re

PHONE_RE = re.compile(
    r"(?<!\d)(?:(?:\+92|0092|92|0)[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{4}|3\d{9})(?!\d)"
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_KEY_RE = re.compile(r"phone|mobile|whatsapp|fax", re.I)
EMAIL_KEY_RE = re.compile(r"e-?mail", re.I)

PHONE_MARK = "[phone]"
EMAIL_MARK = "[email]"


def _redact_str(s: str) -> str:
    return EMAIL_RE.sub(EMAIL_MARK, PHONE_RE.sub(PHONE_MARK, s))


def redact(obj, key: str = ""):
    if isinstance(obj, dict):
        return {k: redact(v, k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v, key) for v in obj]
    if isinstance(obj, str):
        if PHONE_KEY_RE.search(key) and sum(c.isdigit() for c in obj) >= 7:
            return PHONE_MARK
        if EMAIL_KEY_RE.search(key) and "@" in obj:
            return EMAIL_MARK
        return _redact_str(obj)
    if isinstance(obj, int) and not isinstance(obj, bool) and PHONE_KEY_RE.search(key) and obj > 10**8:
        return PHONE_MARK
    return obj
