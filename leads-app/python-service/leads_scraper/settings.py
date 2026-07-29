import os
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv()

BOT_NAME = "leads_scraper"

SPIDER_MODULES = ["leads_scraper.spiders"]
NEWSPIDER_MODULE = "leads_scraper.spiders"

ROBOTSTXT_OBEY = False

# Throttling
DOWNLOAD_DELAY = 4
RANDOMIZE_DOWNLOAD_DELAY = True
CONCURRENT_REQUESTS = 1
CONCURRENT_REQUESTS_PER_DOMAIN = 1

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 3
AUTOTHROTTLE_MAX_DELAY = 15
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0

# NOTE: no "br" here on purpose — Brotli-compressed responses come back as
# unreadable binary unless the `Brotli` package is installed. It is
# installed (see requirements), so this is just belt-and-suspenders.
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

COOKIES_ENABLED = True

# Middlewares
DOWNLOADER_MIDDLEWARES = {
    "leads_scraper.middlewares.RotatingUserAgentMiddleware": 400,
    "leads_scraper.middlewares.PlatformCookieMiddleware": 410,
    "scrapy.downloadermiddlewares.useragent.UserAgentMiddleware": None,
}

# Pipelines
ITEM_PIPELINES = {
    "leads_scraper.pipelines.CleaningPipeline": 200,
    "leads_scraper.pipelines.MongoPipeline": 300,
}

# MongoDB
MONGO_DATABASE = os.getenv("MONGO_DATABASE", "leads_raw")
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb://leads_user:leads_password@127.0.0.1:27017/leads_raw?authSource=admin",
)

# Optional progress callback (Flask microservice / orchestrator). Spiders
# work fine with this unset — report_progress()/closed() just no-op.
CALLBACK_BASE_URL = os.getenv("CALLBACK_BASE_URL", "")

# Retry
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# Safety — CLOSESPIDER_TIMEOUT is a hard backstop: no matter what else
# goes wrong, a targeted run can never actually run forever.
CLOSESPIDER_ERRORCOUNT = 30
CLOSESPIDER_TIMEOUT = 1800  # 30 min hard ceiling per run
MEMUSAGE_ENABLED = True
MEMUSAGE_LIMIT_MB = 512
MEMUSAGE_WARNING_MB = 384

LOG_LEVEL = "INFO"

# Playwright
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {"headless": True}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# OLX API tokens
OLX_ACCESS_TOKEN = os.getenv("OLX_ACCESS_TOKEN")
OLX_ID_TOKEN = os.getenv("OLX_ID_TOKEN")
OLX_REFRESH_TOKEN = os.getenv("OLX_REFRESH_TOKEN")
