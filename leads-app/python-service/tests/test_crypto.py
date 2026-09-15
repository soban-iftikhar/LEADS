import pytest

from leads import crypto
from tests.conftest import TEST_ENC_KEY, TEST_PEPPER


@pytest.mark.parametrize("raw, expected", [
    ("+923320644433", "03320644433"),
    ("923310774648", "03310774648"),
    ("0092 331 0774648", "03310774648"),
    ("0300-1234567", "03001234567"),
    ("3309000012", "03309000012"),  # Graana: 10 digits, no leading 0
    ("03001234567", "03001234567"),
    ("051-1234567", None),          # landline
    ("0313-XXXXXXX", None),         # masked
    ("", None),
    (None, None),
])
def test_normalize_phone(raw, expected):
    assert crypto.normalize_phone(raw) == expected


def test_encrypt_round_trip_uses_random_iv():
    a = crypto.encrypt_phone("03001234567", TEST_ENC_KEY)
    b = crypto.encrypt_phone("03001234567", TEST_ENC_KEY)
    assert a != b
    assert crypto.decrypt_phone(a, TEST_ENC_KEY) == "03001234567"


# Shared test vector: src/server/crypto/phone.ts must produce the same strings.
# pepper = bytes 0..31, key = bytes 32..63, iv = bytes 0..11 (all base64 in conftest).
VECTOR_PHONE = "03001234567"
VECTOR_HASH = "3de51be832065790ba9a0a6d6c20829a68a0579ac5274cd04873e94be2c39a00"
VECTOR_ENC = "AAECAwQFBgcICQoL9wTyRgsa1aFicdYk9CZb92xhbZd7B9jYic/+"  # iv = bytes 0..11


def test_shared_vector_hash():
    assert crypto.hash_phone(VECTOR_PHONE, TEST_PEPPER) == VECTOR_HASH


def test_shared_vector_encrypt_layout():
    token = crypto.encrypt_phone(VECTOR_PHONE, TEST_ENC_KEY, iv=bytes(range(12)))
    assert token == VECTOR_ENC
    import base64
    blob = base64.b64decode(token)
    assert blob[:12] == bytes(range(12))       # iv first
    assert len(blob) == 12 + 16 + len(VECTOR_PHONE)  # iv | tag | ciphertext
    assert crypto.decrypt_phone(token, TEST_ENC_KEY) == VECTOR_PHONE


def test_protect_phone_skips_non_mobile():
    assert crypto.protect_phone("051-1234567", TEST_PEPPER, TEST_ENC_KEY) == (None, None)
    h, e = crypto.protect_phone("+923001234567", TEST_PEPPER, TEST_ENC_KEY)
    assert h == crypto.hash_phone("03001234567", TEST_PEPPER) and crypto.decrypt_phone(e, TEST_ENC_KEY) == "03001234567"
