import { z } from "zod";

export const category = z.enum(["HOUSE", "PLOT", "FLAT", "COMMERCIAL"], { error: () => ({ message: "Pick a property type." }) });
export const sizeUnit = z.enum(["MARLA", "KANAL", "SQFT", "SQYD"], { error: () => ({ message: "Pick a unit." }) });
const uuid = z.uuid({ error: "Pick one from the list." });
const count = z.number().int().min(0).max(50).nullable();

export const createListingSchema = z.object({ category });

/** Everything the owner can change. Empty strings clear a field. */
export const patchListingSchema = z
  .object({
    category,
    sizeValue: z.string().trim().max(12).regex(/^(\d+(\.\d{1,2})?)?$/, "Enter the size as a number, like 10 or 7.5."),
    sizeUnit,
    bedrooms: count,
    bathrooms: count,
    pricePkr: z.string().trim().max(13).regex(/^\d*$/, "Enter the price in rupees, digits only."),
    regionId: uuid,
    localityId: z.union([uuid, z.literal("")]),
    addressText: z.string().trim().max(200),
    description: z.string().trim().max(4000, "Keep the description under 4000 characters."),
    amenities: z.array(z.string().trim().min(1).max(40)).max(30),
    ownerName: z.string().trim().max(100),
  })
  .partial();

export const listingsQuerySchema = z.object({
  status: z.enum(["live", "review", "info", "rejected", "draft", "paused", "sold"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const reorderImagesSchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });
export const listingActionSchema = z.object({ action: z.enum(["pause", "resume", "mark-sold"]) });
export const documentKind = z.enum(["REGISTRY", "TRANSFER_LETTER", "ALLOTMENT_LETTER"]);
export const localitiesQuerySchema = z.object({ region: z.string().trim().min(1).max(60), q: z.string().trim().max(60).optional() });

export type ListingPatchInput = z.infer<typeof patchListingSchema>;
