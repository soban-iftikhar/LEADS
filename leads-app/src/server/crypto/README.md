# crypto

Status: not built yet.

- `phone.ts`: must produce exactly the same output as `python-service/leads/crypto.py`.
  - normalise to `03XXXXXXXXX`
  - `phoneHash = HMAC-SHA256(PHONE_HASH_PEPPER, normalised)`, hex
  - `phoneEnc = base64(iv | tag | ciphertext)`, AES-256-GCM with `PHONE_ENC_KEY`, 12-byte random iv
  - shared test vector: `python-service/tests/test_crypto.py` (`VECTOR_HASH`, `VECTOR_ENC`)
- `token.ts`: random token generation and SHA-256 hashing for sessions, form links and
  verification tokens.

The encrypted number exists in one place only: `app.contacts.phone_enc`. Decrypt only for
lead delivery to the owning customer, the admin send queue, and the messaging worker.
