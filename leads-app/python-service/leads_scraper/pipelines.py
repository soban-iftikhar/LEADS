import re
import pymongo
from datetime import datetime
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem


class CleaningPipeline:
    """Clean and normalise all scraped data."""

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        price_raw = adapter.get("price", "")
        adapter["price_numeric"] = self.parse_price(price_raw)

        size_raw = adapter.get("size", "")
        size_numeric, size_unit = self.parse_size(size_raw)
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

    def parse_price(self, price_str: str) -> int:
        if not price_str:
            return 0
        price_str = price_str.replace(",", "").replace("PKR", "").strip()
        try:
            if "crore" in price_str.lower():
                num = float(re.findall(r"[\d.]+", price_str)[0])
                return int(num * 10_000_000)
            elif "lakh" in price_str.lower():
                num = float(re.findall(r"[\d.]+", price_str)[0])
                return int(num * 100_000)
            else:
                nums = re.findall(r"[\d.]+", price_str)
                return int(float(nums[0])) if nums else 0
        except (IndexError, ValueError):
            return 0

    def parse_size(self, size_str: str):
        if not size_str:
            return 0.0, "Unknown"
        size_str = size_str.strip()
        try:
            if "marla" in size_str.lower():
                num = float(re.findall(r"[\d.]+", size_str)[0])
                return num * 225.0, "Marla"
            elif "kanal" in size_str.lower():
                num = float(re.findall(r"[\d.]+", size_str)[0])
                return num * 4500.0, "Kanal"
            elif "sq" in size_str.lower():
                num = float(re.findall(r"[\d.]+", size_str)[0])
                return num, "Sqft"
            else:
                nums = re.findall(r"[\d.]+", size_str)
                return float(nums[0]) if nums else 0.0, "Unknown"
        except (IndexError, ValueError):
            return 0.0, "Unknown"

    def parse_int(self, value: str) -> int:
        if not value:
            return 0
        nums = re.findall(r"\d+", str(value))
        return int(nums[0]) if nums else 0

    def clean_phone(self, phone: str) -> str:
        cleaned = re.sub(r"[^\d+]", "", phone)
        if cleaned.startswith("+92"):
            return "0" + cleaned[3:]
        if cleaned.startswith("92") and len(cleaned) == 12:
            return "0" + cleaned[2:]
        return cleaned


class DuplicationPipeline:
    """Remove duplicate listings before saving to MongoDB."""

    def __init__(self):
        self.seen = set()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        fingerprint = (
            adapter.get("platform", ""),
            adapter.get("listing_id", ""),
        )
        if fingerprint in self.seen:
            spider.logger.debug(
                f"Duplicate skipped: {adapter.get('listing_id')}"
            )
            raise DropItem(f"Duplicate: {fingerprint}")
        self.seen.add(fingerprint)
        return item


class MongoPipeline:
    """Save cleaned records to MongoDB."""

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
        self.client = pymongo.MongoClient(
            self.mongo_uri,
            serverSelectionTimeoutMS=5000,
        )
        self.db = self.client[self.mongo_db]
        self.collection = self.db["properties"]

        try:
            # Explicitly force authentication check against the client target
            self.client.admin.command("ping")
            spider.logger.info("MongoDB connected successfully")
        except Exception as e:
            spider.logger.error(f"MongoDB authentication connection failed: {e}")
            raise e

        # Wrap index creation safely so it doesn't interrupt item extraction
        try:
            self.collection.create_index(
                [("platform", 1), ("listing_id", 1)],
                unique=True,
            )
            self.collection.create_index([("city", 1)])
            self.collection.create_index([("category", 1)])
            self.collection.create_index([("price_numeric", 1)])
            self.collection.create_index([("scraped_at", -1)])
            spider.logger.info("MongoDB indexes verified/created")
        except Exception as e:
            spider.logger.warning(f"Index check skipped or unauthorized: {e}")

    def close_spider(self, spider):
        self.client.close()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        doc = dict(adapter)
        
        # Convert datetime to string or standard UTC object for BSON optimization
        if isinstance(doc.get("scraped_at"), datetime):
            pass # Pymongo native handlers accept clean datetime instances
            
        try:
            self.collection.update_one(
                {
                    "platform": doc["platform"],
                    "listing_id": doc["listing_id"],
                },
                {"$set": doc},
                upsert=True,
            )
        except Exception as e:
            spider.logger.error(f"MongoDB write authorization failure: {e}")
            raise DropItem(f"Failed to write item to DB: {e}")
            
        return item