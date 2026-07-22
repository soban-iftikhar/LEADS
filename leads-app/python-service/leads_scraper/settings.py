BOT_NAME = "leads_scraper"

SPIDER_MODULES = ["leads_scraper.spiders"]
NEWSPIDER_MODULE = "leads_scraper.spiders"

# Obey robots.txt
ROBOTSTXT_OBEY = False

# Anti-detection settings
DOWNLOAD_DELAY = 4
RANDOMIZE_DOWNLOAD_DELAY = True
CONCURRENT_REQUESTS = 1
CONCURRENT_REQUESTS_PER_DOMAIN = 1
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 3
AUTOTHROTTLE_MAX_DELAY = 15
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0

# Rotating user agents
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Default headers to mimic real browser
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# Enable cookies
COOKIES_ENABLED = True

# Pipelines
ITEM_PIPELINES = {
    "leads_scraper.pipelines.CleaningPipeline": 200,
    "leads_scraper.pipelines.DuplicationPipeline": 300,
    "leads_scraper.pipelines.MongoPipeline": 400,
}

# MongoDB settings
MONGO_URI = "mongodb://localhost:27017/"
MONGO_DATABASE = "leads_raw"

# Retry settings
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# Logging
LOG_LEVEL = "INFO"

# AutoThrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 2
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

DOWNLOADER_MIDDLEWARES = {
    "leads_scraper.middlewares.RotatingUserAgentMiddleware": 400,
    "leads_scraper.middlewares.PlatformCookieMiddleware": 410,
    "scrapy.downloadermiddlewares.useragent.UserAgentMiddleware": None,
}