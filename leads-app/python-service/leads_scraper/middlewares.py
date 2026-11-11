"""Downloader middlewares."""

# Zameen shows city-specific results only when these site-preference cookies are set.
ZAMEEN_COOKIES = {
    "is_elastic_enabled": "true",
    "userCity": "3",
    "userLocation": '{"countryCode":"PK","countryName":"Pakistan","cityName":"Islamabad"}',
    "settings": '{"area":null,"currency":"PKR","installBanner":true,"searchHitsLayout":"LIST"}',
}


class PlatformCookieMiddleware:
    def process_request(self, request, spider=None):
        if "zameen.com" in request.url:
            for key, value in ZAMEEN_COOKIES.items():
                request.cookies[key] = value
