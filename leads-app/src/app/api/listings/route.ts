import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createListingSchema } from "@/lib/validations/listing.schema";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const data = parsed.data;

    const listing = await prisma.listing.create({
      data: {
        title: data.title,
        category: data.category,
        purpose: data.purpose,
        city: data.city,
        locality: data.locality,
        size: data.size,
        sizeUnit: data.sizeUnit,
        price: data.price,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        description: data.description,
        originalDesc: data.description,
        images: data.images,
        sellerId: payload.userId,
      },
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    console.error("Create listing error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}