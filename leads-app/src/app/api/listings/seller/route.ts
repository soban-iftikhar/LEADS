import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function GET(request: NextRequest) {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const listings = await prisma.listing.findMany({
      where: {
        sellerId: user.userId,
        status: { not: "DELETED" },
      },
      select: {
        id: true,
        title: true,
        city: true,
        locality: true,
        price: true,
        status: true,
        viewCount: true,
        images: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const listingsWithLeadCount = listings.map((listing) => ({
      ...listing,
      leadCount: 0, // placeholder until Lead model is added
    }));

    return NextResponse.json(
      { listings: listingsWithLeadCount },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch seller listings error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}