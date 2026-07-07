import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import cloudinary from "@/lib/cloudinary";

// --- Validation rules ---

const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 6000;
const MAX_HEIGHT = 6000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 1. Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WEBP images are allowed" },
        { status: 400 }
      );
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Image must be smaller than ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    // Convert file to a Buffer so sharp + cloudinary can read it
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Validate resolution using sharp
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      return NextResponse.json(
        { error: "Could not read image dimensions" },
        { status: 400 }
      );
    }

    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return NextResponse.json(
        {
          error: `Image resolution too small. Minimum is ${MIN_WIDTH}x${MIN_HEIGHT}px`,
        },
        { status: 400 }
      );
    }

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      return NextResponse.json(
        {
          error: `Image resolution too large. Maximum is ${MAX_WIDTH}x${MAX_HEIGHT}px`,
        },
        { status: 400 }
      );
    }

    // 4. Upload to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "leads/listings" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json(
      {
        url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json(
      { error: "Something went wrong during upload" },
      { status: 500 }
    );
  }
}