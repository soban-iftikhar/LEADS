import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(150),
  category: z.string().min(1, "Category is required"),
  purpose: z.enum(["SALE", "RENT"]),
  city: z.string().min(1, "City is required"),
  locality: z.string().min(1, "Locality is required"),
  size: z.number().positive("Size must be a positive number"),
  sizeUnit: z.enum(["MARLA", "KANAL", "SQFT"]),
  price: z.number().positive("Price must be a positive number"),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  images: z.array(z.string().url()).min(1, "At least one image is required"),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.partial();

export type UpdateListingInput = z.infer<typeof updateListingSchema>;