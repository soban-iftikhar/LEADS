import random


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]


class RotatingUserAgentMiddleware:
    def process_request(self, request, spider=None):
        request.headers["User-Agent"] = random.choice(USER_AGENTS)


class PlatformCookieMiddleware:
    ZAMEEN_COOKIES = {
        "is_elastic_enabled": "true",
        "userCity": "3",
        "userLocation": '{"countryCode":"PK","countryName":"Pakistan","cityName":"Islamabad"}',
        "settings": '{"area":null,"currency":"PKR","installBanner":true,"searchHitsLayout":"LIST","enableMarketingEmailAlerts":false}',
    }

    def process_request(self, request, spider=None):
        if "zameen.com" in request.url:
            for key, value in self.ZAMEEN_COOKIES.items():
                request.cookies[key] = value
    

        # Other platforms — add cookies here when needed