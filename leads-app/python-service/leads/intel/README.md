# leads.intel

Status: not built yet. Celery queue: `intel`.

Turns scraped listings into market intelligence. Runs after each crawl
(`intel.recompute_after_crawl`).

| File | Does | Writes |
|---|---|---|
| `localities.py` | match `master.listings.city/locality` text to `config.localities` (name, slug, aliases) | `master.listings.region_id`, `locality_id` |
| `dedupe.py` | group the same property listed on several portals | `intel.listing_clusters`, `master.listings.cluster_id` |
| `benchmarks.py` | median and quartile price per sq ft by locality, category, purpose, size band | `intel.area_benchmarks` |
| `scoring.py` | quality, price deviation, exit probability, propensity, rank | `intel.listing_scores` |
| `presence.py` | re-check listings not seen recently; mark `status = 'exited'`, set `exited_at` | all `listings` tables |
| `buyer_pool.py` | who sells what, where: the pool campaigns match against | reads `intel.seller_contact_links` |

Every job is idempotent: it can be run twice for the same crawl without changing the result.
