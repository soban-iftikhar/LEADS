import "server-only";
import { env } from "@/server/env";
import { AppError } from "@/server/http/errors";
import { cloudinaryStore } from "./cloudinary";

/**
 * Where uploaded files go. Listing photos are public; ownership documents are private (only the
 * review team may open them). Production always uses Cloudinary. Without Cloudinary keys, local
 * development keeps files on disk so the listing flow can be used end to end.
 */
export interface MediaStore {
  putImage(data: Buffer, folder: string): Promise<{ id: string; url: string }>;
  putDocument(data: Buffer, folder: string, fileName: string): Promise<{ id: string }>;
  remove(id: string, kind: "image" | "document"): Promise<void>;
}

export async function mediaStore(): Promise<MediaStore> {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env();
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) return cloudinaryStore({ cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, apiSecret: CLOUDINARY_API_SECRET });
  // the disk store is development-only: this branch (and the module) is dropped from production builds
  if (process.env.NODE_ENV !== "production") return (await import("./local")).localStore;
  console.error("[media] Cloudinary is not configured");
  throw new AppError(503, "Uploads are not available right now. Please try again later.");
}
