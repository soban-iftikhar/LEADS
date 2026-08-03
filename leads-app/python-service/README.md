# LEADS Scrapers — Zameen, OLX, Graana (base + params redesign)

Redesigned per the revised project scope: every spider now accepts optional
parameters and runs **targeted** (only that combination) if any are given,
or **general** (broad default sweep) if none are given — same spiders,
no separate "lite" version needed anymore.

## Usage

```bash
# Targeted — only this exact combination
scrapy crawl olx -a city=Islamabad -a category=flat -a price_min=5000000 -a price_max=15000000 -a max_records=15

# General — old broad-sweep behavior (city/category loop, sized by full_scrape)
scrapy crawl olx -a full_scrape=true

# Partially targeted — city given, everything else defaults
scrapy crawl graana -a city=Lahore
```

### Parameters (all optional, all spiders)

| Param | Type | Notes |
|---|---|---|
| `city` | string | Platform-specific city name (e.g. "Islamabad") — see each spider's `CITIES`/`CITY_IDS` |
| `category` | string | **Canonical**, not platform-specific — see `leads_scraper/categories.py`. Each spider maps it via its own `CATEGORY_MAP`; a category a platform doesn't support returns nothing (warned in the log), not a substitute. |
| `price_min` / `price_max` | int (PKR) | Enforced in `CleaningPipeline`, not via any site's URL filter — see design note below |
| `purpose` | "sale" / "rent" | Not all platforms fully support both (see per-spider notes) |
| `max_records` | int | Spider stops itself once this many items are saved (`CloseSpider("target_reached")`) |
| `job_id` | string | Optional. If set together with `CALLBACK_BASE_URL` env var, spider POSTs progress/finished callbacks — same shape as the earlier leads-lite prototype. Fully optional; omit both and the spider just runs standalone. |
| `full_scrape` | "true"/"false" | Only relevant in **general** mode (no targeted params given) — `true` sweeps everything each spider knows about, `false` is a smaller default subset. |

## Design notes

- **One canonical category list** (`categories.py`), each spider maps it
  to its own platform value. This is what lets System 1 / System 3 ask
  for `"flat"` without knowing that's `"Flats"` on Zameen, `"Apartments"`
  on OLX, or `"flat"` on Graana.
- **price_min/price_max are enforced in the pipeline, not per-platform URL
  params.** None of the three platforms' URL-level price filters were
  verified reliable enough to depend on — a wrong guess there would
  silently return unfiltered data. The pipeline filter is the one place
  this is guaranteed correct no matter what a given site's search UI
  actually supports.
- **`should_dispatch()` gates new requests only — never a response
  callback.** This was a real, painful bug in the earlier prototype:
  gating a detail-page *callback* on the same cap that governs *new*
  dispatch meant responses already paid for over the network got thrown
  away the moment the cap was hit, sometimes before a single item had
  been collected. Every spider here follows the rule: `should_dispatch()`
  only appears right before yielding a *new* `scrapy.Request`; a callback
  parsing an already-fetched response only ever checks the real goal
  (`records_collected >= max_records`).
- **`CLOSESPIDER_TIMEOUT = 1800`** (30 min) in `settings.py` is a hard
  backstop — no matter what bug might still be lurking, a run can't
  actually go forever.
- **Twisted/pyOpenSSL/service-identity/Brotli are pinned** in
  `requirements.txt`. Installing without these exact pins previously
  caused two separate multi-hour debugging sessions (an
  `ImportError: _setAcceptableProtocols` crash from a too-new Twisted,
  and silently-garbled API responses from missing Brotli decompression
  support). Don't `pip install -U` these later without re-testing.

## What's NOT here yet

- **PropertyOnline.pk** — skipped for now (WordPress site, unreliable).
- **Ilaan.com** — `ilaan.py` has detail-page parsing fully implemented
  from the given field/selector spec, but `start_requests` and
  `parse_listing_page` raise `NotImplementedError` — no search/listing
  page structure or pagination mechanism was available yet. The
  phone-reveal call (`reveal_contact`) is also stubbed — the captured
  request for that endpoint was incomplete (cut off before the payload).
- Scraper orchestration from the Flask microservice — spiders are
  CLI-args-driven (`scrapy crawl X -a ...`) per the current plan; nothing
  here assumes how they get invoked beyond that.
- Native URL-level price/purpose filtering per platform — intentionally
  skipped in favor of the pipeline-side filter (see design notes).
