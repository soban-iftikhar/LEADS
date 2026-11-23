import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { listingTitle, toSqft } from "@/server/modules/listings/rules";
import { daysAgo, type SeedContext } from "./context";
import fixtures from "./customers.json";

type Spec = (typeof fixtures.customers)[number]["listings"][number];

/** Customer accounts (password1) and their listings, upserted by email and listing slug. */
export async function seedCustomers(ctx: SeedContext) {
  const { prisma } = ctx;
  const passwordHash = await bcrypt.hash("password1", 12);
  let listings = 0;
  for (const c of fixtures.customers) {
    const region = await prisma.region.findUnique({ where: { slug: c.region }, select: { id: true } });
    if (!region) continue;
    const role = c.kind === "AGENCY" ? ("CUSTOMER_AGENCY" as const) : ("CUSTOMER_SELLER" as const);
    const profile = { kind: c.kind as "AGENCY" | "SELLER", displayName: c.displayName, contactPerson: c.kind === "AGENCY" ? c.name : null, areas: [], propertyTypes: [], regionId: region.id };
    const base = { fullName: c.name, passwordHash, role, status: "ACTIVE" as const, suspendedAt: null, emailVerifiedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: "2026-11" };
    const user = await prisma.user.upsert({
      where: { email: c.email },
      create: { email: c.email, ...base, customer: { create: profile } },
      update: { ...base, customer: { upsert: { create: profile, update: profile } } },
    });
    for (const l of c.listings) if (await seedListing(ctx, user.id, region.id, c.kind, l)) listings++;
  }
  return `${fixtures.customers.length} customers, ${listings} listings`;
}

async function seedListing({ prisma, ...ctx }: SeedContext, customerId: string, regionId: string, kind: string, l: Spec): Promise<boolean> {
  const locality = await prisma.locality.findFirst({ where: { slug: l.area, regionId }, select: { id: true, name: true } });
  if (!locality) return false;
  const at = daysAgo({ prisma, ...ctx }, l.daysAgo);
  const data = {
    customerId,
    source: kind === "AGENCY" ? ("AGENCY_POSTED" as const) : ("SELF_POSTED" as const),
    title: listingTitle(l.category, l.marla, "MARLA"),
    category: l.category,
    pricePkr: BigInt(l.price),
    sizeValue: new Prisma.Decimal(l.marla),
    sizeUnit: "MARLA",
    sizeSqft: new Prisma.Decimal(toSqft(l.marla, "MARLA")),
    regionId,
    localityId: locality.id,
    description: "Well kept, on a wide road, close to the markaz. Papers clear and ready to transfer.",
    status: l.status as Prisma.ListingCreateInput["status"],
    publishedAt: l.status === "UNDER_REVIEW" ? null : at,
    archivedAt: null,
    updatedAt: at,
  };
  const slug = `seed-admin-${l.key}`;
  await prisma.listing.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  return true;
}
