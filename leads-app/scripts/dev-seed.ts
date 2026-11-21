// Local development data: two demo customers with listings, packages, leads and notifications,
// so every screen has something real to show and the Playwright specs have known accounts.
//
//   demo@leads.pk  / password1   agency "Al-Noor Estate"
//   owner@leads.pk / password1   owner
//
// Run: npm run db:seed:dev  (after `python scripts/seed_config.py`, which seeds cities, areas, plans)
// Re-running resets both accounts. It refuses to run in production.
import "dotenv/config";
import sharp from "sharp";
import { Prisma, PrismaClient, type CustomerStage, type ListingStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { encryptPhone, hashPhone } from "@/server/crypto/phone";
import { mediaStore } from "@/server/integrations/media";
import { listingTitle, toSqft } from "@/server/modules/listings/rules";
import type { SizeUnit } from "@/types/api";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}
const { PHONE_HASH_PEPPER: PEPPER, PHONE_ENC_KEY: KEY } = process.env;
if (!PEPPER || !KEY) {
  console.error("PHONE_HASH_PEPPER and PHONE_ENC_KEY must be set (same values as python-service/.env).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const DAY = 86_400_000;
const MIN = 60_000;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);

/** Numbers in the unallocated 0399 range, so a seeded contact can never be a real person. */
const fakePhone = (n: number) => `0399${String(n).padStart(7, "0")}`;
const phone = (n: number) => ({ phoneHash: hashPhone(fakePhone(n), PEPPER), phoneEnc: encryptPhone(fakePhone(n), KEY) });

const BUYERS = [
  ["Bilal Ahmed", "Ji, interested. Corner hai?", 28, 32, "Buying in 1–3 months"],
  ["Sana Khan", "Kab dekh sakte hain? Weekend ok?", 17, 20, "Ready this month"],
  ["Usman Farooq", null, 42, 48, "Buying in 3–6 months"],
  ["Ayesha Malik", "Price negotiable hai?", 29, 31, "Buying in 1–3 months"],
  ["Hamza Qureshi", "Interested. Send more pictures", 18, 21, "Ready this month"],
  ["Fatima Zahra", "Yes, call me after 6pm", 45, 50, "Buying in 1–3 months"],
  ["Ali Raza", "Haan dekhna hai", 30, 33, "Buying in 3–6 months"],
  ["Zainab Hussain", "Is it still available?", 15, 19, "Buying in 1–3 months"],
  ["Kashif Mehmood", "Visit kab ho sakti hai?", 22, 26, "Buying in 3–6 months"],
  ["Nadia Iqbal", null, 25, 28, "Buying in 1–3 months"],
  ["Faisal Javed", "Interested, details bhejein", 33, 36, "Ready this month"],
  ["Hira Aslam", "Is it still available?", 16, 18, "Buying in 3–6 months"],
] as const;
const STAGES: CustomerStage[] = ["NEW", "NEW", "NEW", "CONTACTED", "VIEWING", "CLOSED_WON", "CONTACTED", "CONTACTED", "VIEWING", "CLOSED_LOST", "CONTACTED", "NEW"];

type ListingSpec = { key: string; category: string; size: number; unit: SizeUnit; price: number; area: string; status: ListingStatus; daysAgo: number; photos: number; beds: number | null; note?: string };

const AGENCY_LISTINGS: ListingSpec[] = [
  { key: "g13", category: "HOUSE", size: 10, unit: "MARLA", price: 31_000_000, area: "g-13-2", status: "APPROVED", daysAgo: 40, photos: 6, beds: 5 },
  { key: "dha", category: "PLOT", size: 1, unit: "KANAL", price: 46_000_000, area: "dha-phase-2", status: "APPROVED", daysAgo: 30, photos: 5, beds: null },
  { key: "bahria", category: "HOUSE", size: 5, unit: "MARLA", price: 19_000_000, area: "bahria-town-phase-8", status: "APPROVED", daysAgo: 26, photos: 5, beds: 3 },
  { key: "b17", category: "HOUSE", size: 8, unit: "MARLA", price: 24_000_000, area: "b-17", status: "NEEDS_INFO", daysAgo: 9, photos: 5, beds: 4, note: "Please upload the registry or transfer letter. We can't put the listing live without proof of ownership." },
  { key: "gulraiz", category: "HOUSE", size: 7, unit: "MARLA", price: 16_000_000, area: "gulraiz", status: "UNDER_REVIEW", daysAgo: 2, photos: 5, beds: 3 },
  { key: "adiala", category: "PLOT", size: 10, unit: "MARLA", price: 8_500_000, area: "adiala-road", status: "REJECTED", daysAgo: 11, photos: 5, beds: null, note: "The photos show a built house but the listing is a plot. Please upload photos of the plot itself." },
];
const OWNER_LISTINGS: ListingSpec[] = [{ key: "own-g13", category: "HOUSE", size: 10, unit: "MARLA", price: 31_000_000, area: "g-13-2", status: "APPROVED", daysAgo: 40, photos: 6, beds: 5 }];

const DESCRIPTION = "Corner house on a 40 ft road, bedrooms with attached baths, double kitchen, servant quarter and a small lawn. Close to the markaz and the main highway.";

async function photo(seed: number): Promise<Buffer> {
  const hue = (seed * 47) % 360;
  const [r, g, b] = [Math.round(120 + 80 * Math.cos(hue)), Math.round(130 + 60 * Math.sin(hue)), 160];
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r, g, b } } }).jpeg({ quality: 70 }).toBuffer();
}
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function account(email: string, fullName: string, kind: "SELLER" | "AGENCY", displayName: string, phoneN: number) {
  const passwordHash = await bcrypt.hash("password1", 12);
  const base = {
    fullName,
    passwordHash,
    role: kind === "AGENCY" ? ("CUSTOMER_AGENCY" as const) : ("CUSTOMER_SELLER" as const),
    status: "ACTIVE" as const,
    emailVerifiedAt: new Date(),
    ...phone(phoneN),
    phoneVerifiedAt: new Date(),
    failedLoginCount: 0,
    lockedUntil: null,
    termsAcceptedAt: new Date(),
    termsVersion: "2026-11",
  };
  const isb = await prisma.region.findUniqueOrThrow({ where: { slug: "islamabad" } });
  const profile = { kind, displayName, contactPerson: kind === "AGENCY" ? fullName : null, areas: [], propertyTypes: [], regionId: kind === "SELLER" ? isb.id : null };
  const user = await prisma.user.upsert({ where: { email }, create: { email, ...base, customer: { create: profile } }, update: { ...base, customer: { upsert: { create: profile, update: profile } } } });
  await reset(user.id);
  return user;
}

/** Removes everything this account owns, children first. */
async function reset(userId: string) {
  const owned = await prisma.listing.findMany({ where: { customerId: userId }, select: { id: true, images: { select: { cloudinaryId: true } }, documents: { select: { cloudinaryId: true } } } });
  const listings = owned.map((l) => l.id);
  const orders = (await prisma.order.findMany({ where: { customerId: userId }, select: { id: true } })).map((o) => o.id);
  const leads = await prisma.lead.findMany({ where: { customerId: userId }, select: { id: true, contactId: true } });
  const campaigns = (await prisma.campaign.findMany({ where: { orderId: { in: orders } }, select: { id: true } })).map((c) => c.id);
  await prisma.$transaction([
    prisma.leadEvent.deleteMany({ where: { leadId: { in: leads.map((l) => l.id) } } }),
    prisma.leadReport.deleteMany({ where: { leadId: { in: leads.map((l) => l.id) } } }),
    prisma.lead.deleteMany({ where: { customerId: userId } }),
    prisma.message.deleteMany({ where: { campaignTarget: { campaignId: { in: campaigns } } } }),
    prisma.campaignTarget.deleteMany({ where: { campaignId: { in: campaigns } } }),
    prisma.campaign.deleteMany({ where: { id: { in: campaigns } } }),
    prisma.cashback.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.payment.deleteMany({ where: { orderId: { in: orders } } }),
    prisma.jobRequest.deleteMany({ where: { dedupeKey: { in: orders.map((id) => `campaign-start:${id}`) } } }),
    prisma.order.deleteMany({ where: { customerId: userId } }),
    prisma.listing.deleteMany({ where: { id: { in: listings } } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { userId } }),
    prisma.contact.deleteMany({ where: { id: { in: leads.map((l) => l.contactId) }, leads: { none: { customerId: { not: userId } } } } }),
  ]);
  const store = await mediaStore();
  for (const l of owned) {
    for (const i of l.images) await store.remove(i.cloudinaryId, "image").catch(() => {});
    for (const d of l.documents) await store.remove(d.cloudinaryId, "document").catch(() => {});
  }
}

async function listing(ownerId: string, kind: "SELLER" | "AGENCY", spec: ListingSpec, n: number) {
  const locality = await prisma.locality.findFirstOrThrow({ where: { slug: spec.area }, select: { id: true, regionId: true, name: true } });
  const created = ago(spec.daysAgo * DAY);
  const title = listingTitle(spec.category, spec.size, spec.unit);
  const l = await prisma.listing.create({
    data: {
      customerId: ownerId,
      source: kind === "AGENCY" ? "AGENCY_POSTED" : "SELF_POSTED",
      slug: `${spec.key}-${ownerId.slice(0, 8)}`,
      title,
      description: DESCRIPTION,
      category: spec.category,
      pricePkr: BigInt(spec.price),
      sizeValue: new Prisma.Decimal(spec.size),
      sizeUnit: spec.unit,
      sizeSqft: new Prisma.Decimal(toSqft(spec.size, spec.unit)),
      regionId: locality.regionId,
      localityId: locality.id,
      bedrooms: spec.beds,
      bathrooms: spec.beds ? spec.beds - 1 : null,
      amenities: [],
      status: spec.status,
      publishedAt: spec.status === "APPROVED" ? new Date(created.getTime() + DAY / 2) : null,
      createdAt: created,
    },
  });
  const store = await mediaStore();
  for (let i = 0; i < spec.photos; i++) {
    const img = await store.putImage(await photo(n * 10 + i), `listings/${l.id}`);
    await prisma.listingImage.create({ data: { listingId: l.id, cloudinaryId: img.id, url: img.url, position: i } });
  }
  if (spec.status !== "NEEDS_INFO") {
    const doc = await store.putDocument(PDF, `documents/${l.id}`, "registry-scan.pdf");
    await prisma.listingDocument.create({ data: { listingId: l.id, kind: "REGISTRY", fileName: "registry-scan.pdf", cloudinaryId: doc.id, uploadedAt: created } });
  }
  await prisma.listingStatusEvent.createMany({
    data: [
      { listingId: l.id, status: "DRAFT", createdAt: created },
      { listingId: l.id, status: "UNDER_REVIEW", createdAt: new Date(created.getTime() + 30 * MIN) },
      ...(spec.status !== "UNDER_REVIEW" ? [{ listingId: l.id, status: spec.status, createdAt: new Date(created.getTime() + DAY / 2) }] : []),
    ],
  });
  if (spec.note) {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
    await prisma.listingReview.create({ data: { listingId: l.id, adminId: admin?.id ?? ownerId, decision: spec.status === "REJECTED" ? "REJECT" : "NEED_INFO", note: spec.note, createdAt: new Date(created.getTime() + DAY / 2) } });
  }
  return { ...l, localityName: locality.name, title };
}

async function order(customerId: string, listingId: string, planName: string, status: "ACTIVE" | "COMPLETED" | "EXPIRED", startDaysAgo: number, delivered: number) {
  const plan = await prisma.packagePlan.findFirstOrThrow({ where: { name: planName } });
  const start = ago(startDaysAgo * DAY);
  const o = await prisma.order.create({
    data: {
      customerId,
      listingId,
      packagePlanId: plan.id,
      leadCount: plan.leadCount,
      pricePkr: plan.pricePkr,
      pricePerLeadPkr: plan.pricePkr / BigInt(plan.leadCount),
      status,
      windowStartsAt: start,
      windowEndsAt: new Date(start.getTime() + plan.deliveryDays * DAY),
      deliveredCount: delivered,
      createdAt: start,
      payments: { create: { provider: "BANK_TRANSFER", amountPkr: plan.pricePkr, status: "SUCCEEDED", createdAt: start } },
    },
  });
  const missing = plan.leadCount - delivered;
  if (status === "EXPIRED" && missing > 0) {
    await prisma.cashback.create({ data: { orderId: o.id, undeliveredCount: missing, amountPkr: o.pricePerLeadPkr * BigInt(missing), status: "PAID", paidAt: new Date(o.windowEndsAt!.getTime() + 5 * DAY) } });
  }
  return { ...o, planName };
}

let phoneSeq = 100;
/** How long ago the newest leads arrived, so "today" and "this week" have something in them. */
const RECENT = [12 * MIN, 2 * 3_600_000, 5 * 3_600_000, 26 * 3_600_000, 30 * 3_600_000, 2 * DAY];

/** `count` leads on one order, each with its contact, campaign target and WhatsApp exchange. */
/** `recent`: the first few arrived today and yesterday; otherwise they are spread from the window start. */
async function leads(customerId: string, l: { id: string; title: string; localityName: string; pricePkr: bigint | null }, o: { id: string; windowStartsAt: Date | null }, count: number, recent: boolean) {
  const campaign = await prisma.campaign.upsert({ where: { orderId: o.id }, create: { orderId: o.id, listingId: l.id, status: "RUNNING", matchParams: {}, startedAt: o.windowStartsAt }, update: {} });
  const created = [];
  for (let i = 0; i < count; i++) {
    const [name, said, bmin, bmax, timeline] = BUYERS[i % BUYERS.length];
    const start = o.windowStartsAt?.getTime() ?? now;
    const end = recent ? now - 3 * DAY : Math.min(now, start + 58 * DAY);
    const spread = new Date(end - ((end - start) * (i + 1)) / (count + 1));
    const at = recent && i < RECENT.length ? ago(RECENT[i]) : spread;
    const contact = await prisma.contact.create({ data: { ...phone(phoneSeq++), name, firstSource: "PORTAL_SELLER" } });
    const target = await prisma.campaignTarget.create({ data: { campaignId: campaign.id, contactId: contact.id, score: new Prisma.Decimal(0.8), status: said ? "INTERESTED" : "FORM_SUBMITTED" } });
    const price = l.pricePkr ? `PKR ${(Number(l.pricePkr) / 10_000_000).toFixed(1)} Cr` : "";
    await prisma.message.create({ data: { contactId: contact.id, campaignTargetId: target.id, direction: "OUT", channel: "WA_API", body: `Assalam o alaikum. A ${l.title} in ${l.localityName} is for sale, ${price}. Interested?`, status: "READ", createdAt: new Date(at.getTime() - 22 * MIN), sentAt: new Date(at.getTime() - 22 * MIN) } });
    if (said) await prisma.message.create({ data: { contactId: contact.id, campaignTargetId: target.id, direction: "IN", channel: "WA_API", body: said, status: "RECEIVED", intent: "INTERESTED", createdAt: at } });
    const stage = STAGES[i % STAGES.length];
    const lead = await prisma.lead.create({
      data: {
        contactId: contact.id,
        listingId: l.id,
        customerId,
        orderId: o.id,
        source: said ? "CAMPAIGN_REPLY" : "CAMPAIGN_FORM",
        countsTowardOrder: true,
        buyerName: name,
        budgetMinPkr: BigInt(bmin * 1_000_000),
        budgetMaxPkr: BigInt(bmax * 1_000_000),
        timeline,
        customerStage: stage,
        deliveredAt: at,
      },
    });
    if (stage !== "NEW") await prisma.leadEvent.create({ data: { leadId: lead.id, kind: "STAGE_CHANGED", data: { from: "NEW", to: stage }, createdAt: new Date(at.getTime() + 3_600_000) } });
    created.push(lead);
  }
  return created;
}

async function followUpsToday(leadIds: string[]) {
  const today = new Date(now + 5 * 3_600_000); // Asia/Karachi, UTC+5
  const at = (h: number, m: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), h - 5, m));
  const plan: [number, Date, "CALL" | "VISIT"][] = [[4, at(16, 0), "VISIT"], [5, at(18, 0), "CALL"], [6, at(19, 30), "CALL"]];
  for (const [i, when, kind] of plan) if (leadIds[i]) await prisma.lead.update({ where: { id: leadIds[i] }, data: { followUpAt: when, followUpKind: kind } });
}

async function notify(userId: string, type: string, payload: Prisma.InputJsonValue, at: Date, read: boolean) {
  await prisma.notification.create({ data: { userId, type, payload, createdAt: at, readAt: read ? new Date(at.getTime() + MIN) : null } });
}

async function main() {
  if (!(await prisma.packagePlan.count()) || !(await prisma.locality.count())) {
    throw new Error("Config is empty. Run `python scripts/seed_config.py` in python-service first.");
  }

  // both accounts are reset before anything is created: seeded contacts reuse the same fake numbers
  const agency = await account("demo@leads.pk", "Imran Qureshi", "AGENCY", "Al-Noor Estate", 1);
  const owner = await account("owner@leads.pk", "Soban Iftikhar", "SELLER", "Soban Iftikhar", 2);

  // agency
  const al: Record<string, Awaited<ReturnType<typeof listing>>> = {};
  for (const [i, spec] of AGENCY_LISTINGS.entries()) al[spec.key] = await listing(agency.id, "AGENCY", spec, i);
  const og13 = await order(agency.id, al.g13.id, "Growth", "ACTIVE", 37, 60);
  const obahria = await order(agency.id, al.bahria.id, "Starter", "ACTIVE", 25, 11);
  const odha = await order(agency.id, al.dha.id, "Starter", "ACTIVE", 12, 5);
  const done = await order(agency.id, al.g13.id, "Starter", "COMPLETED", 100, 25);
  const expired = await order(agency.id, al.bahria.id, "Starter", "EXPIRED", 156, 21);
  const g13Leads = await leads(agency.id, al.g13, og13, 60, true);
  await leads(agency.id, al.g13, done, 25, false);
  await leads(agency.id, al.bahria, expired, 21, false);
  await leads(agency.id, al.bahria, obahria, 11, false);
  await leads(agency.id, al.dha, odha, 5, false);
  await followUpsToday(g13Leads.map((l) => l.id));
  await prisma.lead.update({ where: { id: g13Leads[7].id }, data: { status: "REPORTED", report: { create: { reason: "WRONG_NUMBER", details: "He said he never got our message" } } } });
  await notify(agency.id, "LEAD_DELIVERED", { leadId: g13Leads[0].id, buyerName: g13Leads[0].buyerName, listingTitle: al.g13.title, localityName: al.g13.localityName, said: BUYERS[0][1] }, ago(12 * MIN), false);
  await notify(agency.id, "LEAD_DELIVERED", { leadId: g13Leads[1].id, buyerName: g13Leads[1].buyerName, listingTitle: al.g13.title, localityName: al.g13.localityName, said: BUYERS[1][1] }, ago(2 * 3_600_000), false);
  await notify(agency.id, "LISTING_IN_REVIEW", { listingId: al.gulraiz.id, listingTitle: al.gulraiz.title, localityName: al.gulraiz.localityName }, ago(2 * DAY), true);
  await notify(agency.id, "LISTING_NEEDS_INFO", { listingId: al.b17.id, listingTitle: al.b17.title, localityName: al.b17.localityName, note: "upload the ownership document" }, ago(8 * DAY), true);
  await notify(agency.id, "LISTING_REJECTED", { listingId: al.adiala.id, listingTitle: al.adiala.title, localityName: al.adiala.localityName, note: "photos did not match the plot" }, ago(10 * DAY), true);
  await notify(agency.id, "ORDER_STARTED", { orderId: og13.id, planName: "Growth", leadCount: og13.leadCount, deliveryDays: 60, windowEndsAt: og13.windowEndsAt!.toISOString() }, ago(37 * DAY), true);

  // owner
  const ol = await listing(owner.id, "SELLER", OWNER_LISTINGS[0], 9);
  const oo = await order(owner.id, ol.id, "Growth", "ACTIVE", 37, 60);
  const ownerLeads = await leads(owner.id, ol, oo, 60, true);
  await followUpsToday(ownerLeads.map((l) => l.id));
  await notify(owner.id, "LEAD_DELIVERED", { leadId: ownerLeads[0].id, buyerName: ownerLeads[0].buyerName, listingTitle: ol.title, localityName: ol.localityName, said: BUYERS[0][1] }, ago(12 * MIN), false);
  await notify(owner.id, "LISTING_APPROVED", { listingId: ol.id, listingTitle: ol.title, localityName: ol.localityName }, ago(31 * DAY), true);
  await notify(owner.id, "ORDER_STARTED", { orderId: oo.id, planName: "Growth", leadCount: oo.leadCount, deliveryDays: 60, windowEndsAt: oo.windowEndsAt!.toISOString() }, ago(37 * DAY), true);

  console.log("Demo data ready: demo@leads.pk and owner@leads.pk, password1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
