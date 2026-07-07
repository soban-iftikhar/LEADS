import scrapy


class PropertyItem(scrapy.Item):
    # Source info
    platform = scrapy.Field()        # "zameen"
    listing_id = scrapy.Field()      # external ID from platform
    url = scrapy.Field()             # full detail page URL
    scraped_at = scrapy.Field()      # timestamp

    # Property details
    title = scrapy.Field()
    category = scrapy.Field()        # House, Apartment, Plot, Commercial
    purpose = scrapy.Field()         # For Sale, For Rent
    price = scrapy.Field()           # raw string e.g. "15.95 Crore"
    price_numeric = scrapy.Field()   # converted to PKR integer
    size = scrapy.Field()            # raw string e.g. "5 Marla"
    size_numeric = scrapy.Field()    # converted to sqft float
    size_unit = scrapy.Field()       # Marla, Kanal, Sqft

    # Location
    city = scrapy.Field()
    location = scrapy.Field()        # full location string
    locality = scrapy.Field()        # area/sector

    # Room details
    bedrooms = scrapy.Field()
    bathrooms = scrapy.Field()

    # Description
    description = scrapy.Field()
    amenities = scrapy.Field()       # list of amenity strings

    # Seller/Agency
    seller_name = scrapy.Field()     # agent name
    agency_name = scrapy.Field()
    phone = scrapy.Field()           # primary phone
    mobile = scrapy.Field()
    agency_profile_url = scrapy.Field()

    # Metadata
    added_date = scrapy.Field()      # raw string e.g. "3 hours ago"
    is_project = scrapy.Field()      # False for individual listings