import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) {
        return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const contact = property.mobile || property.phone;
    if (!contact) {
        return NextResponse.json({ error: "This property has no contact number" }, { status: 400 });
    }

    const existing = await prisma.prospect.findFirst({ where: { propertyId } });
    if (existing) {
        return NextResponse.json({ error: "Already contacted this property", prospect: existing }, { status: 409 });
    }

    const prospect = await prisma.prospect.create({
        data: { propertyId, contact },
    });

    return NextResponse.json(prospect, { status: 201 });
}

export async function GET() {
    const prospects = await prisma.prospect.findMany({
        include: { property: true },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(prospects);
}