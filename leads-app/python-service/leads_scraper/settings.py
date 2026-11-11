# Scrapy settings. Values that differ per deployment come from leads.settings
# (environment variables, validated), never from os.getenv here.
from leads.settings import get_settings

_s = get_settings()

BOT_NAME = "leads_scraper"

SPIDER_MODULES = ["leads_scraper.spiders"]
NEWSPIDER_MODULE = "leads_scraper.spiders"

# Respect each portal's published crawling rules. Requests a portal's robots.txt
# disallows are dropped and logged ("Forbidden by robots.txt"), not retried.
ROBOTSTXT_OBEY = _s.robotstxt_obey

# One fixed identity for every request (see leads.settings.scraper_user_agent).
USER_AGENT = _s.scraper_user_agent

# Throttling
DOWNLOAD_DELAY = 4
RANDOMIZE_DOWNLOAD_DELAY = True
CONCURRENT_REQUESTS = 1
CONCURRENT_REQUESTS_PER_DOMAIN = 1

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 3
AUTOTHROTTLE_MAX_DELAY = 15
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0


DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

COOKIES_ENABLED = True

# Middlewares
DOWNLOADER_MIDDLEWARES = {
    "leads_scraper.middlewares.PlatformCookieMiddleware": 410,
}

# Pipelines
ITEM_PIPELINES = {
    "leads_scraper.pipelines.CleaningPipeline": 200,
    "leads_scraper.pipelines.PortalPipeline": 300,
}

# Retry
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# Safety — CLOSESPIDER_TIMEOUT is a hard backstop: no matter what else
# goes wrong, a targeted run can never actually run forever.
CLOSESPIDER_ERRORCOUNT = 30
CLOSESPIDER_TIMEOUT = 6600  # 1 h 50 min: the spider closes itself cleanly (and records its
# result) before the scheduler's 2 h soft limit would stop it
MEMUSAGE_ENABLED = True
MEMUSAGE_LIMIT_MB = 512
MEMUSAGE_WARNING_MB = 384

LOG_LEVEL = "INFO"
TELNETCONSOLE_ENABLED = False

# All four portals work over plain HTTP (FIELD_INVENTORY section 1); no browser is bundled.
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

# OLX API tokens
OLX_ACCESS_TOKEN = _s.olx_access_token
OLX_ID_TOKEN = _s.olx_id_token
OLX_REFRESH_TOKEN = _s.olx_refresh_token
ILAAN_AUTH_TOKEN = _s.ilaan_auth_token
ILAAN_CSRF_TOKEN = _s.ilaan_csrf_token
