import "server-only";
import sharp, { type Metadata } from "sharp";
import { AppError, badInput } from "@/server/http/errors";

/**
 * Upload checks. The browser's declared type is never trusted: photos must decode as an image,
 * documents must start with a PDF, JPEG or PNG signature.
 */

const MB = 1024 * 1024;
export const PHOTO_MAX_BYTES = 8 * MB;
export const DOCUMENT_MAX_BYTES = 10 * MB;
const PHOTO_MIN_SIDE = 400;
const PHOTO_MAX_SIDE = 8000;
/** Photos are re-encoded to this size: smaller files, and any EXIF (GPS) data is dropped. */
const PHOTO_STORE_SIDE = 2000;

/** The `file` field of a multipart request, size-checked before it is read into memory. */
export async function fileFrom(request: Request, maxBytes: number): Promise<{ file: File; form: FormData }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes + 64 * 1024) throw new AppError(413, `That file is over ${Math.round(maxBytes / MB)} MB.`);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError(400, "That upload could not be read.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw badInput({ file: "Choose a file to upload." });
  if (file.size > maxBytes) throw new AppError(413, `That file is over ${Math.round(maxBytes / MB)} MB.`);
  return { file, form };
}

export async function preparePhoto(file: File): Promise<Buffer> {
  const input = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw badInput({ file: "Use a JPG, PNG or WebP photo." });
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw badInput({ file: "Use a JPG, PNG or WebP photo." });
  const { width = 0, height = 0 } = meta;
  if (width < PHOTO_MIN_SIDE || height < PHOTO_MIN_SIDE) throw badInput({ file: `This photo is too small. Use one at least ${PHOTO_MIN_SIDE}×${PHOTO_MIN_SIDE} pixels.` });
  if (width > PHOTO_MAX_SIDE || height > PHOTO_MAX_SIDE) throw badInput({ file: "This photo is too large. Use one under 8000 pixels on each side." });
  return sharp(input).rotate().resize({ width: PHOTO_STORE_SIDE, height: PHOTO_STORE_SIDE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

export async function prepareDocument(file: File): Promise<Buffer> {
  const data = Buffer.from(await file.arrayBuffer());
  const pdf = data.subarray(0, 5).toString("latin1") === "%PDF-";
  const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!pdf && !jpeg && !png) throw badInput({ file: "Upload a PDF, JPG or PNG." });
  return data;
}

export const safeFileName = (name: string) => name.replace(/[\\/\0-\x1f]/g, "").trim().slice(0, 120) || "document";
