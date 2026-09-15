"""Phone normalisation, hashing and encryption (SPEC_00 4.3).

phone_hash = HMAC-SHA256(PHONE_HASH_PEPPER, "03XXXXXXXXX"), hex
phone_enc  = base64(iv | tag | ciphertext), AES-256-GCM with PHONE_ENC_KEY, 12-byte random iv

The web app must produce identical output; tests/test_crypto.py holds the shared vector.
"""

import base64
import hashlib
import hmac
import os
import re

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LEN = 12
TAG_LEN = 16
_MOBILE_RE = re.compile(r"^03\d{9}$")


def normalize_phone(raw: str | int | None) -> str | None:
    """Return a Pakistani mobile number as 03XXXXXXXXX, or None if it is not one."""
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("0092"):
        digits = digits[4:]
    elif digits.startswith("92") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) == 10 and digits.startswith("3"):
        digits = "0" + digits
    return digits if _MOBILE_RE.match(digits) else None


def _key(b64: str) -> bytes:
    return base64.b64decode(b64)


def hash_phone(normalised: str, pepper_b64: str) -> str:
    return hmac.new(_key(pepper_b64), normalised.encode(), hashlib.sha256).hexdigest()


def encrypt_phone(normalised: str, key_b64: str, iv: bytes | None = None) -> str:
    iv = iv or os.urandom(IV_LEN)
    sealed = AESGCM(_key(key_b64)).encrypt(iv, normalised.encode(), None)  # ciphertext | tag
    ciphertext, tag = sealed[:-TAG_LEN], sealed[-TAG_LEN:]
    return base64.b64encode(iv + tag + ciphertext).decode()


def decrypt_phone(token: str, key_b64: str) -> str:
    blob = base64.b64decode(token)
    iv, tag, ciphertext = blob[:IV_LEN], blob[IV_LEN:IV_LEN + TAG_LEN], blob[IV_LEN + TAG_LEN:]
    return AESGCM(_key(key_b64)).decrypt(iv, ciphertext + tag, None).decode()


def protect_phone(raw, pepper_b64: str, key_b64: str) -> tuple[str | None, str | None]:
    """(phone_hash, phone_enc) for a raw phone value, or (None, None) if it is not a mobile."""
    n = normalize_phone(raw)
    if not n:
        return None, None
    return hash_phone(n, pepper_b64), encrypt_phone(n, key_b64)
