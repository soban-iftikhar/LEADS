import "server-only";
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import type { MediaStore } from "./index";

type Keys = { cloudName: string; apiKey: string; apiSecret: string };

let configuredFor: string | undefined;

function sdk(keys: Keys) {
  if (configuredFor !== keys.cloudName) {
    cloudinary.config({ cloud_name: keys.cloudName, api_key: keys.apiKey, api_secret: keys.apiSecret, secure: true });
    configuredFor = keys.cloudName;
  }
  return cloudinary;
}

function upload(keys: Keys, data: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    sdk(keys)
      .uploader.upload_stream(options, (error, result) => (error || !result ? reject(error ?? new Error("Cloudinary returned no result")) : resolve(result)))
      .end(data);
  });
}

export function cloudinaryStore(keys: Keys): MediaStore {
  return {
    async putImage(data, folder) {
      const r = await upload(keys, data, { folder: `leads/${folder}`, resource_type: "image" });
      return { id: r.public_id, url: r.secure_url };
    },
    async putDocument(data, folder) {
      // "authenticated": not reachable by URL without a signed link
      const r = await upload(keys, data, { folder: `leads/${folder}`, resource_type: "auto", type: "authenticated" });
      return { id: r.public_id };
    },
    async remove(id, kind) {
      await sdk(keys).uploader.destroy(id, kind === "image" ? { resource_type: "image" } : { type: "authenticated", resource_type: "image" });
    },
  };
}
