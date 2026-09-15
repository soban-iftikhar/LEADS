"""Item pipelines: RawListingItem -> record -> database (SPEC_01 section 4).

CleaningPipeline  parses the portal payload, protects the phone, applies master rules.
                  It never drops a row for missing price, size or date.
PortalPipeline    buffers records and writes them in batches of WRITE_BATCH_SIZE
                  through store.write_batch: portal upsert, listing events, master upsert
                  and seller contacts, all in the same transaction per batch.
"""

from scrapy.exceptions import DropItem

from leads.crypto import protect_phone
from leads.db import close_pool, get_pool
from leads.settings import get_settings
from leads_scraper.normalize import master_rejection, normalize
from leads_scraper.store import write_batch


class CleaningPipeline:
    def __init__(self):
        self.settings = get_settings()

    def process_item(self, item, spider):
        platform = item["platform"]
        try:
            rec = normalize(platform, item["payload"], item["ctx"], self.settings)
        except (KeyError, TypeError, ValueError) as e:
            # The payload is missing its own id or shape: there is nothing to key a row on.
            spider.records_rejected += 1
            spider.errors.append({"error": f"normalize failed: {e}"})
            raise DropItem(f"[{platform}] unusable payload: {e}") from e

        for warning in rec.pop("_warnings"):
            spider.logger.warning(f"[{platform}] {rec['external_id']}: {warning}")

        phone = rec.pop("_phone", None)
        rec["phone_hash"], rec["phone_enc"] = protect_phone(
            phone, self.settings.phone_hash_pepper, self.settings.phone_enc_key
        )
        rec["master_rejected_reason"] = master_rejection(rec)
        return rec


class PortalPipeline:
    def __init__(self):
        self.settings = get_settings()
        self.buffer: list[dict] = []
        self.closing = False

    def open_spider(self, spider):
        self.pool = get_pool()

    def process_item(self, rec, spider):
        self.buffer.append(rec)
        spider.records_collected += 1
        if len(self.buffer) >= self.settings.write_batch_size:
            self.flush(spider)
        if (spider.max_records is not None and spider.records_collected >= spider.max_records
                and not self.closing):
            # CloseSpider only works from spider callbacks; from a pipeline, ask the engine.
            self.closing = True
            spider.crawler.engine.close_spider(spider, "max_records reached")
        return rec

    def close_spider(self, spider):
        try:
            self.flush(spider)
        finally:
            close_pool()

    def flush(self, spider):
        if not self.buffer:
            return
        batch, self.buffer = self.buffer, []
        res = write_batch(self.pool, batch, self.settings.phone_purge_days)
        spider.items_new += res.new
        spider.items_updated += res.updated
        spider.records_rejected += res.rejected
        for platform, ext, err in res.failed:
            spider.errors.append({"error": f"write failed {platform}/{ext}: {err}"})
        spider.logger.info(
            f"[{spider.platform_name}] wrote {len(batch)}: new={res.new} updated={res.updated} "
            f"events={res.events} master={res.master} rejected={res.rejected} "
            f"contacts={res.contacts} failed={len(res.failed)}"
        )
