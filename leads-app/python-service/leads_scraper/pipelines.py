import re
import pymongo
from datetime import datetime
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem, CloseSpider


class CleaningPipeline:
    """
    Parses raw scraped strings into usable numeric fields, and enforces
    price_min/price_max as a hard filter here — after price_numeric is
    known — rather than relying on any platform's URL-level price filter
    actually working. This is the one place price range is guaranteed
    correct regardless of what each site's search UI supports.
    """

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        price_numeric = self.parse_price(adapter.get("price", ""))
        if price_numeric is None:
            spider.records_rejected += 1
            raise DropItem(f"No valid price — dropped: {adapter.get('url')}")
        adapter["price_numeric"] = price_numeric

        if spider.price_min is not None and price_numeric < spider.price_min:
            spider.records_rejected += 1
            raise DropItem(f"Below price_min ({price_numeric} < {spider.price_min}): {adapter.get('url')}")
        if spider.price_max is not None and price_numeric > spider.price_max:
            spider.records_rejected += 1
            raise DropItem(f"Above price_max ({price_numeric} > {spider.price_max}): {adapter.get('url')}")

        size_numeric, size_unit = self.parse_size(adapter.get("size", ""))
        if size_numeric is None:
            spider.records_rejected += 1
            raise DropItem(f"No valid size — dropped: {adapter.get('url')}")
        adapter["size_numeric"] = size_numeric
        adapter["size_unit"] = size_unit

        adapter["bedrooms"] = self.parse_int(adapter.get("bedrooms", ""))
        adapter["bathrooms"] = self.parse_int(adapter.get("bathrooms", ""))

        phone = adapter.get("phone", "")
        if phone:
            adapter["phone"] = self.clean_phone(phone)

        desc = adapter.get("description", "")
        if desc:
            adapter["description"] = " ".join(desc.split())

        adapter["scraped_at"] = datetime.utcnow()

        return item

    def parse_price(self, price_str: str):
        if not price_str:
            return None
        price_str = price_str.replace(",", "").replace("PKR", "").strip()
        try:
            lower = price_str.lower()
            if "crore" in lower or " cr" in lower:
                num = float(re.findall(r"[\d.]+", price_str)[0])
                return int(num * 10_000_000)
            elif "lakh" in lower or "lac" in lower:
                num = float(re.findall(r"[\d.]+", price_str)[0])
                return int(num * 100_000)
            else:
                nums = re.findall(r"[\d.]+", price_str)
                return int(float(nums[0])) if nums else None
        except (IndexError, ValueError):
            return None

    def parse_size(self, size_str: str):
        if not size_str:
            return None, None
        size_str = size_str.strip()
        try:
            lower = size_str.lower()
            if "marla" in lower:
                num = float(re.findall(r"[\d.]+", size_str)[0])
                return num, "Marla"
            elif "kanal" in lower:
                num = float(re.findall(r"[\d.]+", size_str)[0])
                return num, "Kanal"
            elif "sq" in lower:
                num = float(re.findall(r"[\d.]+", size_str)[0])
                return num, "Sqft"
            else:
                nums = re.findall(r"[\d.]+", size_str)
                return (float(nums[0]), "Unknown") if nums else (None, None)
        except (IndexError, ValueError):
            return None, None

    def parse_int(self, value) -> int:
        nums = re.findall(r"\d+", str(value))
        return int(nums[0]) if nums else 0

    def clean_phone(self, phone: str) -> str:
        cleaned = re.sub(r"[^\d+]", "", phone)
        if cleaned.startswith("+92"):
            return "0" + cleaned[3:]
        if cleaned.startswith("92") and len(cleaned) == 12:
            return "0" + cleaned[2:]
        return cleaned


class MongoPipeline:
    """
    Saves the cleaned item, updates the spider's own records_collected
    counter (so should_dispatch() and any external progress callback see
    it immediately), and stops the spider once max_records is hit —
    exactly the pattern that turned out to matter a lot: raising
    CloseSpider here, combined with should_dispatch() capping new
    requests spider-side, is what keeps a targeted run from grinding
    through a large backlog after the target's already been reached.
    """

    def __init__(self, mongo_uri, mongo_db):
        self.mongo_uri = mongo_uri
        self.mongo_db = mongo_db

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            mongo_uri=crawler.settings.get("MONGO_URI"),
            mongo_db=crawler.settings.get("MONGO_DATABASE"),
        )

    def open_spider(self, spider):
        self.client = pymongo.MongoClient(self.mongo_uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[self.mongo_db]
        self.collection = self.db["properties"]

        try:
            self.client.admin.command("ping")
            spider.logger.info("MongoDB connected successfully")
        except Exception as e:
            spider.logger.error(f"MongoDB connection failed: {e}")
            raise

        try:
            self.collection.create_index([("platform", 1), ("listing_id", 1)], unique=True)
            self.collection.create_index([("city", 1)])
            self.collection.create_index([("category", 1)])
            self.collection.create_index([("price_numeric", 1)])
            self.collection.create_index([("scraped_at", -1)])
        except Exception as e:
            spider.logger.warning(f"Index creation skipped: {e}")

    def close_spider(self, spider):
        self.client.close()

    def process_item(self, item, spider):
        doc = dict(ItemAdapter(item))

        if spider.max_records is not None and spider.records_collected >= spider.max_records:
            raise DropItem("Target already reached")

        try:
            self.collection.update_one(
                {"platform": doc["platform"], "listing_id": doc["listing_id"]},
                {"$set": doc},
                upsert=True,
            )
        except Exception as e:
            spider.records_rejected += 1
            spider.logger.error(f"MongoDB write failure: {e}")
            raise DropItem(f"DB write failure: {e}")

        spider.records_collected += 1
        spider.report_progress()

        if spider.max_records is not None and spider.records_collected >= spider.max_records:
            raise CloseSpider("target_reached")

        return item
