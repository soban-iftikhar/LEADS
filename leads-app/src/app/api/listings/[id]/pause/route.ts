import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.listing.findUnique({
      where: { id },
      select: { sellerId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (existing.sellerId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (existing.status !== "ACTIVE" && existing.status !== "PAUSED") {
      return NextResponse.json(
        {
          error: `Cannot toggle pause on a listing with status ${existing.status}`,
        },
        { status: 400 }
      );
    }

    const newStatus = existing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";

    const updated = await prisma.listing.update({
      where: { id },
      data: { status: newStatus },
    });

    return NextResponse.json({ listing: updated }, { status: 200 });
  } catch (error) {
    console.error("Pause listing error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}