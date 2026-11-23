import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { DAY_MS, type SeedContext } from "./context";
import market from "./market.json";

const MARLA_SQFT = 225;
const LAC = 100_000;
// a little over a year, so "last 12 months" has a starting point
const SNAPSHOT_DAYS = 400;

// repeatable noise in [-1, 1) from a string, so re-runs write the same values
const wobble = (key: string) => (crypto.createHash("sha1").update(key).digest().readUInt32BE(0) / 2 ** 32) * 2 - 1;
const dayIso = (d: Date) => d.toISOString().slice(0, 10);

type Loc = { id: string; slug: string; name: string; region: { name: string } };
type Area = (typeof market.areas)[number];

/**
 * Market fixtures: portal listings for sale in each area (homes on sale and current medians),
 * buyer accounts who picked the area (buyers looking), and a year of daily price snapshots.
 */
export async function seedMarket(ctx: SeedContext) {
  const { prisma } = ctx;
  const locs = await prisma.locality.findMany({ where: { slug: { in: market.areas.map((a) => a.slug) } }, select: { id: true, slug: true, name: true, region: { select: { name: true } } } });
  let listings = 0;
  let buyers = 0;
  const snaps: Prisma.AreaPriceSnapshotCreateManyInput[] = [];
  for (const a of market.areas) {
    const loc = locs.find((l) => l.slug === a.slug);
    if (!loc) continue;
    for (const [type, t] of Object.entries(market.types)) {
      for (const [band, b] of Object.entries(market.bands)) {
        const perMarla = a.price * LAC * t.price * b.price;
        const homes = Math.max(2, Math.round(a.homes * t.homes * b.homes * market.scale));
        listings += await seedListings(ctx, loc, { type, portal: t.portal, marla: b.marla, band, perMarla, homes });
        snaps.push(...snapshots(ctx, loc.id, a, t.category, band, perMarla, homes));
      }
    }
    buyers += await seedBuyers(ctx, loc, a);
  }
  await prisma.areaPriceSnapshot.deleteMany({ where: { localityId: { in: locs.map((l) => l.id) } } });
  for (let i = 0; i < snaps.length; i += 5000) await prisma.areaPriceSnapshot.createMany({ data: snaps.slice(i, i + 5000) });
  return `${listings} listings, ${buyers} buyers, ${snaps.length} snapshots`;
}

type Spec = { type: string; portal: string; marla: number; band: string; perMarla: number; homes: number };

async function seedListings({ prisma, now }: SeedContext, loc: Loc, s: Spec) {
  for (let i = 0; i < s.homes; i++) {
    const externalId = `seed-admin-${loc.slug}-${s.type}-${s.band}-${i}`;
    const marla = s.marla * (1 + 0.04 * wobble(`${externalId}:size`));
    const price = BigInt(Math.round(s.perMarla * marla * (1 + 0.08 * wobble(`${externalId}:price`))));
    const data = {
      url: `https://www.zameen.com/Property/${externalId}.html`,
      title: `${s.marla} Marla ${s.type} for sale in ${loc.name}`,
      category: s.portal,
      purpose: "sale",
      priceRaw: `PKR ${price}`,
      pricePkr: price,
      sizeRaw: `${s.marla} Marla`,
      sizeValue: new Prisma.Decimal(marla.toFixed(2)),
      sizeUnit: "marla",
      sizeSqft: new Prisma.Decimal((marla * MARLA_SQFT).toFixed(2)),
      city: loc.region.name,
      locality: loc.name,
      locationText: `${loc.name}, ${loc.region.name}`,
      listedAt: new Date(now.getTime() - (i % 30) * DAY_MS),
      listedAtPrecision: "exact",
      scrapedAt: now,
      lastSeenAt: now,
      contentHash: externalId,
      localityId: loc.id,
      status: "active",
    };
    await prisma.masterListing.upsert({
      where: { platform_externalId: { platform: "zameen", externalId } },
      create: { platform: "zameen", externalId, sourceRowId: crypto.randomUUID(), sourceSchema: "zameen", ...data },
      update: data,
    });
  }
  return s.homes;
}

/** A year of daily medians, back-cast from today's price with the area's yearly change. */
function snapshots({ now }: SeedContext, localityId: string, a: Area, category: string, band: string, perMarla: number, homes: number) {
  return Array.from({ length: SNAPSHOT_DAYS }, (_, back) => {
    const v = (perMarla / Math.pow(1 + a.change / 100, back / 365)) * (1 + (back > 0 ? 0.006 * wobble(`${a.slug}${category}${band}${back}`) : 0));
    return { localityId, category, sizeBand: band, day: new Date(dayIso(new Date(now.getTime() - back * DAY_MS))), medianPerMarla: new Prisma.Decimal(v.toFixed(2)), listings: homes };
  });
}

/** Buyer accounts that picked the area: enough for its buyers-per-home on 10 Marla houses. */
async function seedBuyers({ prisma, now }: SeedContext, loc: Loc, a: Area) {
  const want = Math.round(Math.max(2, Math.round(a.homes * market.scale)) * a.buyers);
  // unusable password: these accounts only exist to be counted
  const passwordHash = `!seed-${crypto.randomBytes(16).toString("hex")}`;
  for (let i = 0; i < want; i++) {
    const email = `seed-buyer-${loc.slug}-${i}@example.test`;
    const lastLoginAt = new Date(now.getTime() - (i % 20) * DAY_MS);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, fullName: `Buyer ${loc.name} ${i + 1}`, role: "BUYER", passwordHash, lastLoginAt },
      update: { status: "ACTIVE", lastLoginAt },
    });
    await prisma.buyerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, name: user.fullName, preferredAreas: [loc.id] }, update: { preferredAreas: [loc.id] } });
  }
  return want;
}
