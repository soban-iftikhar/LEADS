import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { updateListingSchema } from "@/lib/validations/listing.schema";

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

    if (!existing || existing.status === "DELETED") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (existing.sellerId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ listing: updated }, { status: 200 });
  } catch (error) {
    console.error("Update listing error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const confirm = request.nextUrl.searchParams.get("confirm");
    if (confirm !== "true") {
      return NextResponse.json(
        {
          error: "Deletion requires confirmation",
          hint: "Resend this request with ?confirm=true to proceed",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.listing.findUnique({
      where: { id },
      select: { sellerId: true, status: true },
    });

    if (!existing || existing.status === "DELETED") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (existing.sellerId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.listing.update({
      where: { id },
      data: { status: "DELETED" },
    });

    return NextResponse.json(
      { message: "Listing deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete listing error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}