"""OLX login renewal.

OLX access tokens live 15 minutes, so the ones copied from the browser are always stale by
the nightly run. The account's refresh token (an "offline" token) is exchanged at OLX's
login server for a new access token at the start of each run, exactly as the OLX website
does. OLX may issue a new refresh token each time; the latest one is kept in Redis so the
chain survives restarts. If renewal fails, the tokens from the environment are used as-is.
"""

import logging

import redis
import requests

from leads.settings import get_settings

log = logging.getLogger(__name__)

TOKEN_URL = "https://auth.olx.com.pk/auth/realms/olx-pk/protocol/openid-connect/token"
CLIENT_ID = "frontend"
REDIS_KEY = "olx:refresh_token"


def _redis():
    return redis.Redis.from_url(get_settings().celery_broker_url, decode_responses=True)


def renew(env_refresh: str | None, *, rds=None, post=requests.post) -> dict | None:
    """Returns {"access_token", "id_token"} on success, else None. Never raises."""
    try:
        rds = _redis() if rds is None else rds
        stored = rds.get(REDIS_KEY)
    except Exception as e:  # noqa: BLE001 - Redis down: still try the env token
        log.warning("olx auth: redis unavailable (%s)", type(e).__name__)
        rds, stored = None, None

    # Try the newest token first; fall back to the env one (a freshly pasted token wins
    # over a chain that has since been revoked).
    for candidate in dict.fromkeys(t for t in (stored, env_refresh) if t):
        try:
            r = post(TOKEN_URL, data={"grant_type": "refresh_token", "client_id": CLIENT_ID,
                                      "refresh_token": candidate}, timeout=20)
        except Exception as e:  # noqa: BLE001
            log.warning("olx auth: login server unreachable (%s)", type(e).__name__)
            return None
        if r.status_code != 200:
            log.warning("olx auth: refresh token refused (HTTP %s)", r.status_code)
            continue
        body = r.json()
        if rds is not None and body.get("refresh_token"):
            try:
                rds.set(REDIS_KEY, body["refresh_token"])
            except Exception:  # noqa: BLE001
                pass
        log.info("olx auth: access token renewed")
        return {"access_token": body.get("access_token"), "id_token": body.get("id_token")}
    log.error("olx auth: no usable refresh token; copy new OLX tokens from the browser into the env")
    return None
