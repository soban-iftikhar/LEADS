import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/server/env";

let configured = false;

/** The configured Cloudinary SDK. Configured on first use, so importing needs no credentials. */
export function getCloudinary(): typeof cloudinary {
  if (!configured) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env();
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary credentials are not set: cannot upload images");
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
    configured = true;
  }
  return cloudinary;
}
