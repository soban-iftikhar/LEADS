"""Downloader middlewares."""

import json

# Zameen shows city-specific results only when its site-preference cookies name the city.
# The city comes from the request (config.portal_region_maps via the spider), never from code.
ZAMEEN_BASE_COOKIES = {
    "is_elastic_enabled": "true",
    "settings": '{"area":null,"currency":"PKR","installBanner":true,"searchHitsLayout":"LIST"}',
}


class PlatformCookieMiddleware:
    def process_request(self, request, spider=None):
        if "zameen.com" not in request.url:
            return
        for key, value in ZAMEEN_BASE_COOKIES.items():
            request.cookies[key] = value
        city = request.meta.get("zameen_city")
        if city:
            request.cookies["userCity"] = str(city["id"])
            request.cookies["userLocation"] = json.dumps(
                {"countryCode": "PK", "countryName": "Pakistan", "cityName": city["name"]}, separators=(",", ":"))
