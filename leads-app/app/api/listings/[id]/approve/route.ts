import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const listing = await prisma.legacyListing.findUnique({
      where: { id },
      select: {
        sellerId: true,
        status: true,
        originalDesc: true,
        aiEnhancedDesc: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.sellerId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (listing.status !== "PENDING_AI_REVIEW") {
      return NextResponse.json(
        { error: `Listing cannot be approved from its current status (${listing.status})` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const useAiVersion = body?.useAiVersion === true;

    const finalDescription =
      useAiVersion && listing.aiEnhancedDesc
        ? listing.aiEnhancedDesc
        : listing.originalDesc;

    const updated = await prisma.legacyListing.update({
      where: { id },
      data: {
        description: finalDescription ?? "",
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ listing: updated }, { status: 200 });
  } catch (error) {
    console.error("Approve listing error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}