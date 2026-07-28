import re
import pymongo
from datetime import datetime, timezone
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem


class CleaningPipeline:
    """
    Stage 1 — Clean and normalise all scraped records.
    Drops any record where price cannot be parsed to a valid integer.
    Increments spider.records_rejected on drop.
    """

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        # ── Price ──────────────────────────────────────────────────────────
        price_numeric = self.parse_price(adapter.get("price", ""))
        if price_numeric is None:
            spider.records_rejected += 1
            raise DropItem(
                f"[{adapter.get('platform')}] No valid price — dropped: "
                f"{adapter.get('url', 'unknown')}"
            )
        adapter["price_numeric"] = price_numeric

        # ── Size ───────────────────────────────────────────────────────────
        size_numeric, size_unit = self.parse_size(adapter.get("size", ""))
        adapter["size_numeric"] = size_numeric
        adapter["size_unit"]    = size_unit

        # ── Listing age in days ────────────────────────────────────────────
        adapter["listing_age_days"] = self.parse_age_days(
            adapter.get("added_date", "")
        )

        # ── Price per sqft (for trend analytics) ──────────────────────────
        if size_numeric and size_unit == "Sqft" and price_numeric:
            adapter["price_per_sqft"] = round(price_numeric / size_numeric, 2)
        else:
            adapter["price_per_sqft"] = None

        # ── ISO week number (for velocity computation) ─────────────────────
        adapter["scraped_week"] = datetime.now(timezone.utc).isocalendar()[1]

        # ── Bedrooms / Bathrooms ───────────────────────────────────────────
        adapter["bedrooms"]  = self.parse_int(adapter.get("bedrooms",  ""))
        adapter["bathrooms"] = self.parse_int(adapter.get("bathrooms", ""))

        # ── Phone ──────────────────────────────────────────────────────────
        phone = adapter.get("phone", "")
        if phone:
            adapter["phone"] = self.normalise_phone(phone)

        # ── Description ───────────────────────────────────────────────────
        desc = adapter.get("description", "")
        if desc:
            adapter["description"] = " ".join(desc.split())

        # ── Timestamp ─────────────────────────────────────────────────────
        adapter["scraped_at"] = datetime.now(timezone.utc)

        return item

    # ── Price parser ──────────────────────────────────────────────────────────

    def parse_price(self, price_str: str):
        if not price_str:
            return None
        cleaned = (
            price_str
            .replace(",", "")
            .replace("PKR", "")
            .replace("Rs", "")
            .replace("Rs.", "")
            .strip()
        )
        try:
            lower = cleaned.lower()
            nums  = re.findall(r"[\d.]+", cleaned)
            if not nums:
                return None
            num = float(nums[0])
            if "crore" in lower or "cr" in lower:
                return int(num * 10_000_000)
            elif "lakh" in lower or "lac" in lower:
                return int(num * 100_000)
            elif "thousand" in lower or "k" in lower:
                return int(num * 1_000)
            else:
                return int(num) if num > 0 else None
        except (ValueError, IndexError):
            return None

    # ── Size parser ───────────────────────────────────────────────────────────

    def parse_size(self, size_str: str):
        if not size_str:
            return None, None
        size_str = size_str.strip()
        try:
            lower = size_str.lower()
            nums  = re.findall(r"[\d.]+", size_str)
            if not nums:
                return None, None
            num = float(nums[0])
            if "kanal" in lower:
                return round(num * 4500.0, 2), "Sqft"   # normalise to sqft
            elif "marla" in lower:
                return round(num * 225.0, 2), "Sqft"    # 1 marla = 225 sqft
            elif "sq" in lower or "sqft" in lower or "square" in lower:
                return round(num, 2), "Sqft"
            else:
                return round(num, 2), "Unknown"
        except (ValueError, IndexError):
            return None, None

    # ── Listing age parser ────────────────────────────────────────────────────

    def parse_age_days(self, age_str: str) -> int:
        """
        Convert human-readable age strings to integer days.
        "Added 2 days ago" → 2
        """
        if not age_str:
            return 0
        lower = age_str.lower()
        nums  = re.findall(r"\d+", lower)
        num   = int(nums[0]) if nums else 1
        try:
            if "just" in lower or "hour" in lower or "minute" in lower:
                return 0
            elif "day" in lower:
                return num
            elif "week" in lower:
                return num * 7
            elif "month" in lower:
                return num * 30
            elif "year" in lower:
                return num * 365
            else:
                return 0
        except (ValueError, IndexError):
            return 0

    # ── Int parser ────────────────────────────────────────────────────────────

    def parse_int(self, value: str) -> int:
        nums = re.findall(r"\d+", str(value))
        return int(nums[0]) if nums else 0

    # ── Phone normaliser ──────────────────────────────────────────────────────

    def normalise_phone(self, phone: str) -> str:
        """
        Normalise all Pakistani phone number formats to 03XX-XXXXXXX style.
        """
        cleaned = re.sub(r"[^\d+]", "", phone)
        # remove leading +
        cleaned = cleaned.lstrip("+")
        # 923XXXXXXXXX → 03XXXXXXXXX
        if cleaned.startswith("92") and len(cleaned) == 12:
            cleaned = "0" + cleaned[2:]
        # already 11 digits starting with 0
        if cleaned.startswith("0") and len(cleaned) == 11:
            return f"{cleaned[:4]}-{cleaned[4:]}"
        return cleaned


class MongoPipeline:
    """
    Stage 2 — Save cleaned records to MongoDB.
    Uses upsert on (platform, listing_id) so re-runs update
    existing records rather than creating duplicates.
    Increments spider.records_collected on successful write.
    """

    def __init__(self, mongo_uri, mongo_db):
        self.mongo_uri = mongo_uri
        self.mongo_db  = mongo_db

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            mongo_uri=crawler.settings.get("MONGO_URI"),
            mongo_db=crawler.settings.get("MONGO_DATABASE"),
        )

    def open_spider(self, spider):
        self.client = pymongo.MongoClient(
            self.mongo_uri,
            serverSelectionTimeoutMS=5000,
        )
        self.db         = self.client[self.mongo_db]
        self.collection = self.db["properties"]

        try:
            self.client.admin.command("ping")
            spider.logger.info("[MongoDB] Connected successfully")
        except Exception as e:
            spider.logger.error(f"[MongoDB] Connection failed: {e}")
            raise

        # ── Indexes ────────────────────────────────────────────────────────
        # Unique index for deduplication
        # Other indexes for market intelligence queries
        try:
            self.collection.create_index(
                [("platform", 1), ("listing_id", 1)],
                unique=True,
                name="platform_listing_unique",
            )
            self.collection.create_index(
                [("city", 1), ("category", 1)],
                name="city_category",
            )
            self.collection.create_index(
                [("price_numeric", 1)],
                name="price_numeric",
            )
            self.collection.create_index(
                [("scraped_at", -1)],
                name="scraped_at_desc",
            )
            self.collection.create_index(
                [("scraped_week", 1), ("city", 1), ("category", 1)],
                name="trend_analytics",
            )
            self.collection.create_index(
                [("listing_age_days", 1)],
                name="listing_age",
            )
            spider.logger.info("[MongoDB] Indexes verified")
        except Exception as e:
            spider.logger.warning(f"[MongoDB] Index setup skipped: {e}")

    def close_spider(self, spider):
        self.client.close()
        spider.logger.info("[MongoDB] Connection closed")

    def process_item(self, item, spider):
        doc = dict(ItemAdapter(item))
        try:
            self.collection.update_one(
                {
                    "platform":   doc["platform"],
                    "listing_id": doc["listing_id"],
                },
                {"$set": doc},
                upsert=True,
            )
            spider.records_collected += 1
        except Exception as e:
            spider.logger.error(f"[MongoDB] Write failed: {e}")
            raise DropItem(f"DB write failed: {e}")
        return item