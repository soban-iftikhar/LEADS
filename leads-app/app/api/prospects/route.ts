import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTemplateMessage, WhatsAppSendError } from "@/lib/whatsapp/client";
import { normalizeForWhatsApp } from "@/lib/whatsapp/phone";

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

  const waNumber = normalizeForWhatsApp(contact);
  if (!waNumber) {
    return NextResponse.json({ error: `Could not normalize "${contact}" for WhatsApp` }, { status: 400 });
  }

  const existing = await prisma.prospect.findFirst({ where: { propertyId } });
  if (existing) {
    return NextResponse.json({ error: "Already contacted this property", prospect: existing }, { status: 409 });
  }

  const prospect = await prisma.prospect.create({
    data: { propertyId, contact },
  });

  try {
    const waMessageId = await sendTemplateMessage(waNumber, property.sellerName || "");
    const updated = await prisma.prospect.update({
      where: { id: prospect.id },
      data: { waMessageId },
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (e) {
    const detail = e instanceof WhatsAppSendError ? e.detail : String(e);
    return NextResponse.json({ prospect, warning: "Message send failed", detail }, { status: 201 });
  }
}

export async function GET() {
  const prospects = await prisma.prospect.findMany({
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(prospects);
}