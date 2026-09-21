import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth/guards";
import { sendTemplateMessage, WhatsAppSendError } from "@/server/modules/messaging/whatsapp/client";
import { normalizeForWhatsApp } from "@/server/modules/messaging/whatsapp/phone";

const createProspectSchema = z.object({ propertyId: z.string().min(1) });

// Starts WhatsApp outreach to a scraped property's seller. Admin only: it sends
// messages from our number and exposes seller contact details.
export async function POST(req: NextRequest) {
  const auth = requireRole(req, "ADMIN");
  if (!auth.ok) return auth.response;

  const parsed = createProspectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }
  const { propertyId } = parsed.data;

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
    return NextResponse.json({ error: "The contact number is not a valid mobile number" }, { status: 400 });
  }

  const existing = await prisma.legacyProspect.findFirst({ where: { propertyId } });
  if (existing) {
    return NextResponse.json({ error: "Already contacted this property", prospect: existing }, { status: 409 });
  }

  const prospect = await prisma.legacyProspect.create({
    data: { propertyId, contact },
  });

  try {
    const waMessageId = await sendTemplateMessage(waNumber, property.sellerName || "");
    const updated = await prisma.legacyProspect.update({
      where: { id: prospect.id },
      data: { waMessageId },
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (e) {
    // The provider's raw error stays in the server log; the client gets a safe message.
    console.error("Prospect outreach send failed:", e instanceof WhatsAppSendError ? e.detail : e);
    return NextResponse.json({ prospect, warning: "Message send failed" }, { status: 201 });
  }
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, "ADMIN");
  if (!auth.ok) return auth.response;

  const prospects = await prisma.legacyProspect.findMany({
    include: { property: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(prospects);
}
