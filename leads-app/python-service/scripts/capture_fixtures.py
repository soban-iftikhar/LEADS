"""Capture real listing payloads per portal into samples/<portal>/ (gitignored).

Used for the field inventory. Phone numbers and emails are replaced with fake
values of the same shape before anything is written.

`--export-tests` copies 3 samples per portal into tests/fixtures/<portal>/ with
personal names and account ids also replaced. Only those files are committed.

Usage:
    python scripts/capture_fixtures.py [--portal zameen|olx|graana|ilaan] [--count 20]
    python scripts/capture_fixtures.py --export-tests
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "samples"
TEST_FIXTURES = ROOT / "tests" / "fixtures"
load_dotenv(ROOT / ".env")

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
DELAY_S = 2.0

session = requests.Session()
session.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})


def get(url, **kw):
    time.sleep(DELAY_S)
    r = session.get(url, timeout=40, **kw)
    r.raise_for_status()
    return r


# --- redaction --------------------------------------------------------------

# Pakistani mobile / landline shapes: +92 / 0092 / 92 / 0 prefix, optional separators,
# plus the bare 10-digit 3xxxxxxxxx form some portals use.
PHONE_RE = re.compile(
    r"(?<!\d)(?:(?:\+92|0092|92|0)[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{4}|3\d{9})(?!\d)"
)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Any field with one of these in its key is treated as a phone, whatever its format.
PHONE_KEY_RE = re.compile(r"phone|mobile|whatsapp|fax", re.I)


def _fake_digits(seed: str, n: int) -> str:
    h = hashlib.sha256(seed.encode()).hexdigest() * 2
    return "".join(str(int(c, 16) % 10) for c in h)[:n]


def _fake_number(original: str, keep: int = 4) -> str:
    """Keep the first `keep` digits (operator prefix) and separators, fake the rest."""
    digits = [c for c in original if c.isdigit()]
    fake = _fake_digits(original, max(len(digits) - keep, 0))
    out, i = [], 0
    for c in original:
        if c.isdigit():
            out.append(digits[i] if i < keep else fake[i - keep])
            i += 1
        else:
            out.append(c)
    return "".join(out)


def _redact_str(s: str) -> str:
    s = PHONE_RE.sub(lambda m: _fake_number(m.group(0)), s)
    return EMAIL_RE.sub("redacted@example.com", s)


def redact(obj, key: str = ""):
    if isinstance(obj, dict):
        return {k: redact(v, k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v, key) for v in obj]
    if isinstance(obj, str):
        if PHONE_KEY_RE.search(key) and sum(c.isdigit() for c in obj) >= 7:
            return _fake_number(obj)
        return _redact_str(obj)
    if isinstance(obj, int) and not isinstance(obj, bool) and PHONE_KEY_RE.search(key):
        return int(_fake_number(str(obj)))
    return obj


def save(portal: str, external_id: str, payload: dict):
    out = SAMPLES / portal
    out.mkdir(parents=True, exist_ok=True)
    payload = {"captured_at": datetime.now(timezone.utc).isoformat(), **redact(payload)}
    (out / f"{external_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def existing(portal: str) -> set:
    d = SAMPLES / portal
    return {f.stem for f in d.glob("*.json")} if d.exists() else set()


def links_round_robin(searches, pattern, prefix):
    """Fetch every search page once and interleave their links so the sample mixes cities/categories."""
    per = []
    for search in searches:
        html = get(search).text
        per.append([(search, prefix + l) for l in dict.fromkeys(re.findall(pattern, html))])
    out, seen = [], set()
    for i in range(max(map(len, per), default=0)):
        for lst in per:
            if i < len(lst) and lst[i][1] not in seen:
                seen.add(lst[i][1])
                out.append(lst[i])
    return out


# --- embedded state helpers -------------------------------------------------

def window_state(html: str) -> dict:
    m = re.search(r"window\.state\s*=\s*", html)
    if not m:
        raise ValueError("window.state not found")
    obj, _ = json.JSONDecoder().raw_decode(html, m.end())
    return obj


def next_data(html: str) -> dict:
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        raise ValueError("__NEXT_DATA__ not found")
    return json.loads(m.group(1))


# --- portals ----------------------------------------------------------------

def _capture_html_portal(portal, searches, link_re, prefix, count, fetch):
    """fetch(url, search) -> (external_id, payload). Skips ids already on disk."""
    have = existing(portal)
    for search, url in links_round_robin(searches, link_re, prefix):
        if len(have) >= count:
            return
        try:
            ext, payload = fetch(url, search, have)
        except Exception as e:  # keep going; one bad page should not stop the sample
            print(f"[{portal}] skip {url}: {e}", file=sys.stderr)
            continue
        if ext is None:
            continue
        save(portal, ext, {"source_url": url, "search_url": search, **payload})
        have.add(ext)
        print(f"[{portal}] {len(have)}/{count} {ext}")
    if len(have) < count:
        print(f"[{portal}] only {len(have)}/{count} captured", file=sys.stderr)


def capture_zameen(count: int):
    base = "https://www.zameen.com"
    searches = [
        f"{base}/Homes/Islamabad-3-1.html?purpose=1",
        f"{base}/Plots/Rawalpindi-41-1.html?purpose=1",
        f"{base}/Flats/Islamabad-3-1.html?purpose=2",
        f"{base}/Homes/Rawalpindi-41-1.html?purpose=2",
        f"{base}/Commercial/Islamabad-3-1.html?purpose=1",
    ]

    def fetch(url, search, have):
        detail = window_state(get(url, headers={"Referer": search}).text)["property"]["data"]
        ext = str(detail["externalID"])
        if ext in have:
            return None, None
        phones = get(
            f"{base}/api/showNumbers?listingExternalID={ext}&isProject=false",
            headers={"Accept": "application/json", "Referer": url,
                     "X-Requested-With": "XMLHttpRequest"},
        ).json()
        return ext, {"detail": detail, "show_numbers": phones}

    _capture_html_portal("zameen", searches, r'href="(/Property/[^"]+\.html)"', base, count, fetch)


def capture_olx(count: int):
    token, id_token = os.getenv("OLX_ACCESS_TOKEN"), os.getenv("OLX_ID_TOKEN")
    base = "https://www.olx.com.pk"
    searches = [
        f"{base}/houses_c1721/?location=islamabad",
        f"{base}/apartments-flats_c1725/?location=rawalpindi",
        f"{base}/residential-plots-land-plots_c40/?filter=type_eq_residential-plots-sale&location=islamabad",
        f"{base}/houses_c1721/?location=rawalpindi",
        f"{base}/portions-floors_c41/?location=islamabad",
    ]

    def fetch(url, search, have):
        detail = window_state(get(url, headers={"Referer": search}).text)["ad"]["data"]
        ext = str(detail["externalID"])
        if ext in have:
            return None, None
        contact = None
        if token:
            time.sleep(DELAY_S)
            r = session.get(
                f"{base}/api/listing/{ext}/contactInfo/",
                headers={"Accept": "application/json", "Referer": url,
                         "X-Requested-With": "XMLHttpRequest"},
                cookies={"kc_access_token": token, "kc_id_token": id_token or ""},
                timeout=40,
            )
            is_json = "json" in r.headers.get("content-type", "")
            contact = {"status": r.status_code, "body": r.json() if is_json else None}
        return ext, {"detail": detail, "contact_info": contact}

    _capture_html_portal("olx", searches, r'href="(/item/[^"]+)"', base, count, fetch)


def capture_graana(count: int):
    base = "https://www.graana.com"
    searches = [
        f"{base}/sale/house-sale-Islamabad-1/?pageSize=30&page=1",
        f"{base}/sale/plot-sale-Rawalpindi-1/?pageSize=30&page=1",
        f"{base}/rent/flat-rent-Islamabad-1/?pageSize=30&page=1",
        f"{base}/sale/shop-sale-Islamabad-1/?pageSize=30&page=1",
        f"{base}/rent/house-rent-Rawalpindi-1/?pageSize=30&page=1",
    ]

    def fetch(url, search, have):
        detail = next_data(get(url, headers={"Referer": search}).text)["props"]["pageProps"]["data"]
        ext = str(detail["id"])
        if ext in have:
            return None, None
        return ext, {"detail": detail}

    _capture_html_portal("graana", searches, r'href="(/property/[^"]+)"', base, count, fetch)


def capture_ilaan(count: int):
    api = "https://npi.ilaan.com/api/properties-new/v2"
    reveal = "https://npi.ilaan.com/api/properties-new/{pid}/reveal-contact?channel=call"
    # Ilaan cityId: 3 = Islamabad, 10 = Rawalpindi (checked against cityName in responses)
    combos = [(3, "House", "ForSale"), (10, "House", "ForSale"), (3, "Plot", "ForSale"),
              (10, "Plot", "ForSale"), (3, "Flat", "ForRent"), (10, "House", "ForRent"),
              (3, "Flat", "ForSale")]
    have = existing("ilaan")
    per_combo = -(-count // len(combos)) + 1
    for city_id, ptype, status in combos:
        got = 0
        for page in range(1, 6):
            if got >= per_combo or len(have) >= count:
                break
            url = (f"{api}?page={page}&pageSize=20&cityId={city_id}&type={ptype}"
                   f"&status={status}&areaUnit=Marla&verified=true")
            data = get(url, headers={"Accept": "application/json"}).json()["data"]
            for entry in data["data"]:
                if got >= per_combo or len(have) >= count:
                    break
                pid = str(entry["propertyId"])
                if pid in have:
                    continue
                time.sleep(DELAY_S)
                r = session.post(reveal.format(pid=pid), data=b"{}", timeout=40,
                                 headers={"Accept": "application/json",
                                          "Content-Type": "application/json"})
                is_json = "json" in r.headers.get("content-type", "")
                contact = {"status": r.status_code, "body": r.json() if is_json else None}
                save("ilaan", pid, {"source_url": url, "listing": entry, "reveal_contact": contact})
                have.add(pid)
                got += 1
                print(f"[ilaan] {len(have)}/{count} {pid}")
            if not data.get("pagination", {}).get("hasMore"):
                break
    if len(have) < count:
        print(f"[ilaan] only {len(have)}/{count} captured", file=sys.stderr)


# --- sanitised test fixtures -------------------------------------------------

# Paths that hold a private person's name.
PERSON_NAME_PATHS = {
    "detail.contactName",                 # zameen
    "contact_info.body.name",             # olx
    "detail.contactInfo.name",            # olx
    "detail.name",                        # graana
    "detail.agentDetails.name",           # graana
    "detail.agentDetails.family_name",    # graana
    "listing.agentName",                  # ilaan
}
# Keys that hold an account id, wherever they appear.
ACCOUNT_ID_KEYS = {"Username", "sub", "userId", "agentId", "riderId",
                   "userExternalID", "ownerID", "custom:agency_id"}


def _fake_id(v):
    if isinstance(v, int):
        return int(_fake_digits(str(v), len(str(v))))
    return "00000000-0000-0000-0000-" + _fake_digits(str(v), 12)


def sanitise(obj, path: str = ""):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            sub = f"{path}.{k}" if path else k
            if sub in PERSON_NAME_PATHS and isinstance(v, str) and v:
                out[k] = "Test Seller"
            elif k in ACCOUNT_ID_KEYS and isinstance(v, (str, int)) and not isinstance(v, bool) and v:
                out[k] = _fake_id(v)
            else:
                out[k] = sanitise(v, sub)
        return out
    if isinstance(obj, list):
        return [sanitise(v, path + "[]") for v in obj]
    return obj


def export_tests(per_portal: int = 3):
    """Pick a varied set (different category/purpose) per portal and write sanitised copies."""
    for portal_dir in sorted(p for p in SAMPLES.iterdir() if p.is_dir()):
        files = sorted(portal_dir.glob("*.json"))
        picked, seen_search = [], set()
        for f in files:  # one per search URL first, for variety
            doc = json.loads(f.read_text())
            key = doc.get("search_url") or doc.get("source_url", "").split("&type=")[-1]
            if key not in seen_search:
                seen_search.add(key)
                picked.append((f, doc))
            if len(picked) == per_portal:
                break
        out = TEST_FIXTURES / portal_dir.name
        out.mkdir(parents=True, exist_ok=True)
        for f, doc in picked:
            (out / f.name).write_text(
                json.dumps(sanitise(redact(doc)), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8")
        print(f"[{portal_dir.name}] {len(picked)} test fixtures -> {out.relative_to(ROOT)}")


PORTALS = {"zameen": capture_zameen, "olx": capture_olx,
           "graana": capture_graana, "ilaan": capture_ilaan}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--portal", choices=PORTALS, action="append")
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--export-tests", action="store_true")
    args = ap.parse_args()
    if args.export_tests:
        export_tests()
        sys.exit(0)
    for name in args.portal or PORTALS:
        PORTALS[name](args.count)
