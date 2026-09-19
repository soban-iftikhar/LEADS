"""Admin alerts by email through Resend."""

import logging

import requests

from leads.settings import get_settings

log = logging.getLogger(__name__)


def send_admin_email(subject: str, text: str) -> bool:
    s = get_settings()
    if not (s.resend_api_key and s.email_from and s.admin_alert_email):
        log.warning("alert not sent (RESEND_API_KEY / EMAIL_FROM / ADMIN_ALERT_EMAIL not set): %s", subject)
        return False
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.email_from, "to": [s.admin_alert_email], "subject": subject, "text": text},
            timeout=20,
        )
        r.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001 - an alert failure must never fail the run
        log.error("alert email failed: %s", e)
        return False


def crawl_run_alert(run_id: str, status: str, stats: dict) -> bool:
    lines = [f"Crawl run {run_id} ended: {status.upper()}", ""]
    for platform, p in (stats.get("portals") or {}).items():
        line = f"- {platform}: {p['status']}, seen {p['seen']}, new {p['new']}, errors {p['errors']}"
        if p.get("error"):
            line += f" ({p['error']})"
        lines.append(line)
    lines += ["", "Details: master.crawl_runs and master.crawl_run_portals."]
    return send_admin_email(f"[LEADS] Crawl run {status}", "\n".join(lines))
