import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { enhanceListingWithAi } from "@/lib/gemini";

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

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: {
        sellerId: true,
        status: true,
        title: true,
        category: true,
        originalDesc: true,
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
        { error: `Listing has already moved past AI review (status: ${listing.status})` },
        { status: 400 }
      );
    }

    const aiResult = await enhanceListingWithAi(
      listing.title,
      listing.category,
      listing.originalDesc ?? ""
    );

    if (!aiResult) {
      return NextResponse.json(
        {
          aiAvailable: false,
          message:
            "AI review is temporarily unavailable. You can still approve and publish using your original description.",
          originalDescription: listing.originalDesc,
        },
        { status: 200 }
      );
    }

    await prisma.listing.update({
      where: { id },
      data: { aiEnhancedDesc: aiResult.enhancedDescription },
    });

    return NextResponse.json(
      {
        aiAvailable: true,
        originalDescription: listing.originalDesc,
        enhancedDescription: aiResult.enhancedDescription,
        suggestedCategory: aiResult.suggestedCategory,
        categoryMatches: aiResult.categoryMatches,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("AI review error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}