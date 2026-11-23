import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { encryptPhone, hashPhone } from "@/server/crypto/phone";
import type { SeedContext } from "./context";
import selection from "./selection.json";

const unit = (key: string) => crypto.createHash("sha1").update(key).digest().readUInt32BE(0) / 2 ** 32;
// numbers in the unallocated 0399 range, so a seeded seller can never be a real person
const fakePhone = (n: number) => `0399${String(5_000_000 + n).padStart(7, "0")}`;

/** Ranking scores and seller contacts for the seeded portal listings (prisma/seed/admin/market). */
export async function seedSelection({ prisma, now }: SeedContext) {
  const { PHONE_HASH_PEPPER: pepper, PHONE_ENC_KEY: key } = process.env;
  if (!pepper || !key) throw new Error("PHONE_HASH_PEPPER and PHONE_ENC_KEY must be set.");
  const rows = await prisma.masterListing.findMany({ where: { externalId: { startsWith: "seed-admin-" } }, select: { id: true, externalId: true }, orderBy: { externalId: "asc" } });
  let contacts = 0;
  for (const [i, r] of rows.entries()) {
    const quality = 0.55 + 0.4 * unit(`${r.externalId}:q`);
    const deviation = (unit(`${r.externalId}:d`) - 0.5) * 24;
    const score = { qualityScore: new Prisma.Decimal(quality.toFixed(4)), priceDeviationPct: new Prisma.Decimal(deviation.toFixed(2)), propensityScore: new Prisma.Decimal(unit(`${r.externalId}:p`).toFixed(4)), rankScore: new Prisma.Decimal((quality - Math.max(0, deviation) / 200).toFixed(4)), modelVersion: selection.modelVersion, computedAt: now };
    await prisma.listingScore.upsert({ where: { masterListingId: r.id }, create: { masterListingId: r.id, ...score }, update: score });
    if (unit(`${r.externalId}:n`) < selection.withNumber) {
      const phone = fakePhone(i);
      const phoneHash = hashPhone(phone, pepper);
      const contact = await prisma.contact.upsert({ where: { phoneHash }, create: { phoneHash, phoneEnc: encryptPhone(phone, key), firstSource: "PORTAL_SELLER", name: `Seller ${i + 1}` }, update: {} });
      await prisma.masterListing.update({ where: { id: r.id }, data: { contactId: contact.id, phoneHash } });
      contacts++;
    }
  }
  return `${rows.length} scores, ${contacts} seller numbers`;
}
