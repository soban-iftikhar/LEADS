import os
import re
import uuid
from datetime import datetime, timezone
import psycopg2
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem, CloseSpider
from datetime import timedelta

RELATIVE_DATE_RE = re.compile(
    r"(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago", re.IGNORECASE
)



class CleaningPipeline:

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

        adapter["scraped_at"] = datetime.now(timezone.utc)
        adapter["listed_at"] = self.parse_listed_at(adapter.get("added_date", ""), adapter["scraped_at"])

        if spider.since_hours is not None:
            cutoff = adapter["scraped_at"] - timedelta(hours=spider.since_hours)
            # Unparseable date is treated as too old to trust — a freshness
            # filter must never let an unknown age silently through.
            if adapter["listed_at"] is None or adapter["listed_at"] < cutoff:
                spider.records_rejected += 1
                raise DropItem(f"Older than {spider.since_hours}h cutoff: {adapter.get('url')}")

        return item

    def parse_listed_at(self, raw: str, scraped_at: datetime):
        if not raw:
            return None
        raw = raw.strip()

        # Graana/Ilaan give real ISO timestamps — use directly.
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass

        # Zameen/OLX give relative text — compute an absolute estimate.
        match = RELATIVE_DATE_RE.search(raw)
        if not match:
            return None

        amount, unit = int(match.group(1)), match.group(2).lower()
        unit_map = {
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
            "month": timedelta(days=amount * 30),
            "year": timedelta(days=amount * 365),
        }
        return scraped_at - unit_map[unit]

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


class PostgresPipeline:
    """
    Writes into the same `properties` table Prisma's schema.prisma
    defines and migrates — this pipeline never touches schema, only
    inserts/updates rows. Column names are quoted exactly matching
    Prisma's camelCase convention (no @map per field, same as your
    existing User/Listing models), since Postgres is case-sensitive
    for quoted identifiers and Prisma always quotes.
    """

    PURPOSE_MAP = {"sale": "SALE", "rent": "RENT"}
    SIZE_UNIT_MAP = {"marla": "MARLA", "kanal": "KANAL", "sqft": "SQFT", "unknown": "UNKNOWN"}

    def __init__(self, dsn):
        self.dsn = dsn

    @classmethod
    def from_crawler(cls, crawler):
        return cls(dsn=crawler.settings.get("POSTGRES_DSN"))

    def open_spider(self, spider):
        self.conn = psycopg2.connect(self.dsn)
        self.conn.autocommit = True
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT 1")
            spider.logger.info("Postgres connected successfully")
        except Exception as e:
            spider.logger.error(f"Postgres connection failed: {e}")
            raise

    def close_spider(self, spider):
        self.conn.close()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        if spider.max_records is not None and spider.records_collected >= spider.max_records:
            raise DropItem("Target already reached")

        purpose = self.PURPOSE_MAP.get((adapter.get("purpose") or "").lower())
        size_unit = self.SIZE_UNIT_MAP.get((adapter.get("size_unit") or "").lower(), "UNKNOWN")

        row_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO properties (
                        id, platform, "listingId", url, title, category, purpose,
                        price, "priceNumeric", size, "sizeNumeric", "sizeUnit",
                        city, location, locality, bedrooms, bathrooms, description,
                        amenities, "sellerName", "agencyName", phone, mobile,
                        "agencyProfileUrl", "addedDate", "listedAt", "isProject", "scrapedAt",
                        "createdAt", "updatedAt"
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s
                    )
                    ON CONFLICT (platform, "listingId") DO UPDATE SET
                        url = EXCLUDED.url,
                        title = EXCLUDED.title,
                        category = EXCLUDED.category,
                        purpose = EXCLUDED.purpose,
                        price = EXCLUDED.price,
                        "priceNumeric" = EXCLUDED."priceNumeric",
                        size = EXCLUDED.size,
                        "sizeNumeric" = EXCLUDED."sizeNumeric",
                        "sizeUnit" = EXCLUDED."sizeUnit",
                        city = EXCLUDED.city,
                        location = EXCLUDED.location,
                        locality = EXCLUDED.locality,
                        bedrooms = EXCLUDED.bedrooms,
                        bathrooms = EXCLUDED.bathrooms,
                        description = EXCLUDED.description,
                        amenities = EXCLUDED.amenities,
                        "sellerName" = EXCLUDED."sellerName",
                        "agencyName" = EXCLUDED."agencyName",
                        phone = EXCLUDED.phone,
                        mobile = EXCLUDED.mobile,
                        "agencyProfileUrl" = EXCLUDED."agencyProfileUrl",
                        "addedDate" = EXCLUDED."addedDate",
                        "listedAt" = EXCLUDED."listedAt",
                        "isProject" = EXCLUDED."isProject",
                        "scrapedAt" = EXCLUDED."scrapedAt",
                        "updatedAt" = EXCLUDED."updatedAt"
                    """,
                    (
                        row_id, adapter.get("platform"), adapter.get("listing_id"), adapter.get("url"),
                        adapter.get("title"), adapter.get("category"), purpose,
                        adapter.get("price"), adapter.get("price_numeric"), adapter.get("size"),
                        adapter.get("size_numeric"), size_unit,
                        adapter.get("city"), adapter.get("location"), adapter.get("locality"),
                        adapter.get("bedrooms", 0), adapter.get("bathrooms", 0), adapter.get("description"),
                        adapter.get("amenities", []), adapter.get("seller_name"), adapter.get("agency_name"),
                        adapter.get("phone"), adapter.get("mobile"),
                        adapter.get("agency_profile_url"), adapter.get("added_date"),
                        adapter.get("listed_at"),
                        adapter.get("is_project", False), adapter.get("scraped_at", now),
                        now, now,
                    ),
                )
        except Exception as e:
            spider.records_rejected += 1
            spider.logger.error(f"Postgres write failure: {e}")
            raise DropItem(f"DB write failure: {e}")

        spider.records_collected += 1
        spider.report_progress()

        if spider.max_records is not None and spider.records_collected >= spider.max_records:
            raise CloseSpider("target_reached")

        return item