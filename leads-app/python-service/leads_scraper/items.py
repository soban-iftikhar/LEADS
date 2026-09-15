import scrapy


class RawListingItem(scrapy.Item):
    """One listing as the portal sent it. CleaningPipeline turns it into a record."""

    platform = scrapy.Field()  # zameen | olx | graana | ilaan
    payload = scrapy.Field()   # portal JSON, same shape as tests/fixtures/<portal>/*.json
    ctx = scrapy.Field()       # {scraped_at, category, purpose, city, url}
