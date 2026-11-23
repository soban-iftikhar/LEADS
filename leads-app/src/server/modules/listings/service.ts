import "server-only";
import { slugify } from "@/lib/slug";
import crypto from "node:crypto";
import { Prisma, type ListingStatus, type ReviewDecision } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError, badInput, conflict, notFound } from "@/server/http/errors";
import { suggestDescription, type DescriptionSuggestion } from "@/server/integrations/gemini";
import { mediaStore } from "@/server/integrations/media";
import { activeRegionById, localityInRegion } from "@/server/modules/catalog/service";
import { notifyUser } from "@/server/modules/notifications/service";
import { setting } from "@/server/modules/settings/service";
import { LISTING_FROM_FILTER, type ListingFilter } from "@/lib/labels";
import type { DocumentKind, ListingCard, ListingCategory, ListingCounts, ListingDetail, SizeUnit } from "@/types/api";
import { EDITABLE, OWNER_ACTIONS, type OwnerAction, qualityChecks, qualityScore, type QualityRules, REVIEWED_FIELDS, SUBMITTABLE, listingTitle, toSqft } from "./rules";
import type { ListingPatchInput } from "./schema";
import { prepareDocument, preparePhoto, safeFileName } from "./uploads";

/**
 * Customer listings (SPEC_02 5.12). Every function takes the owner's user id and every query is
 * scoped by it: someone else's listing id behaves exactly like a missing one.
 */

export type Owner = { id: string; kind: "SELLER" | "AGENCY"; phoneVerified: boolean };

const DAY = 86_400_000;
const MAX_PHOTOS = 30;
const COMPLETE_REQUIRED: readonly ListingStatus[] = ["UNDER_REVIEW", "APPROVED", "PAUSED", "SOLD"];

const cardInclude = {
  region: { select: { name: true } },
  locality: { select: { id: true, name: true } },
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
  orders: { where: { status: "ACTIVE" }, orderBy: { windowEndsAt: "asc" }, take: 1, include: { packagePlan: { select: { name: true } } } },
  _count: { select: { images: true, documents: true, leads: true } },
} satisfies Prisma.ListingInclude;

const detailInclude = {
  ...cardInclude,
  images: { orderBy: { position: "asc" }, select: { id: true, url: true, position: true } },
  documents: { orderBy: { uploadedAt: "desc" }, select: { id: true, kind: true, fileName: true, uploadedAt: true } },
  reviews: { orderBy: { createdAt: "desc" }, select: { decision: true, note: true, createdAt: true } },
  statusEvents: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
} satisfies Prisma.ListingInclude;

type CardRow = Prisma.ListingGetPayload<{ include: typeof cardInclude }>;
type DetailRow = Prisma.ListingGetPayload<{ include: typeof detailInclude }>;

const REVIEW_STATUS: Record<ReviewDecision, ListingStatus> = { APPROVE: "APPROVED", REJECT: "REJECTED", NEED_INFO: "NEEDS_INFO" };
const daysLeft = (end: Date) => Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY));

function checksFor(l: CardRow, owner: Owner, rules: QualityRules) {
  return qualityChecks(
    { category: l.category, sizeValue: l.sizeValue, localityId: l.localityId, pricePkr: l.pricePkr, description: l.description, photos: l._count.images, documents: l._count.documents, phoneVerified: owner.phoneVerified },
    rules,
  );
}

function toCard(l: CardRow, owner: Owner, rules: QualityRules): ListingCard {
  const order = l.orders[0];
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    category: l.category as ListingCategory,
    locality: { id: l.locality?.id ?? "", name: l.locality?.name ?? "", regionId: l.regionId, regionName: l.region.name },
    pricePkr: (l.pricePkr ?? BigInt(0)).toString(),
    sizeValue: l.sizeValue ? l.sizeValue.toString() : "",
    sizeUnit: l.sizeUnit as SizeUnit,
    status: l.status,
    qualityScore: l.status === "DRAFT" ? null : qualityScore(checksFor(l, owner, rules)),
    leadCount: l._count.leads,
    createdAt: l.createdAt.toISOString(),
    activeOrder:
      order?.windowEndsAt
        ? { id: order.id, planName: order.packagePlan.name, leadCount: order.leadCount, deliveredCount: order.deliveredCount, windowEndsAt: order.windowEndsAt.toISOString(), daysLeft: daysLeft(order.windowEndsAt) }
        : null,
    coverUrl: l.images[0]?.url ?? null,
  };
}

function toDetail(l: DetailRow, owner: Owner, rules: QualityRules): ListingDetail {
  const checks = checksFor(l, owner, rules);
  return {
    ...toCard({ ...l, images: l.images.slice(0, 1) }, owner, rules),
    description: l.description,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    addressText: l.addressText,
    amenities: l.amenities,
    images: l.images,
    documents: l.documents.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName, uploadedAt: d.uploadedAt.toISOString() })),
    quality: { checks, passed: checks.filter((c) => c.passed).length, total: checks.length },
    // filled from intel.area_benchmarks once the market-intelligence job writes it
    benchmark: null,
    reviews: l.reviews.map((r) => ({ decision: REVIEW_STATUS[r.decision], note: r.note, createdAt: r.createdAt.toISOString() })),
    timeline: l.statusEvents.map((e) => ({ status: e.status, at: e.createdAt.toISOString() })),
    ownerName: owner.kind === "AGENCY" ? l.ownerName : null,
    editable: canEdit(l),
  };
}

async function ownListingRow(ownerId: string, id: string, db: Prisma.TransactionClient = prisma) {
  const l = await db.listing.findFirst({ where: { id, customerId: ownerId, status: { not: "ARCHIVED" } }, include: { locality: { select: { name: true } } } });
  if (!l) throw notFound("We couldn't find that listing.");
  return l;
}

/** True when a listing may be edited: the usual statuses, or a live listing being re-reviewed after an edit. */
const canEdit = (l: { status: ListingStatus; publishedAt: Date | null }) => EDITABLE.includes(l.status) || (l.status === "UNDER_REVIEW" && l.publishedAt !== null);

// ---------------------------------------------------------------- reads

export async function listMyListings(owner: Owner, q: { status?: ListingFilter; page: number; pageSize: number }) {
  const where: Prisma.ListingWhereInput = { customerId: owner.id, status: { not: "ARCHIVED" } };
  const filtered: Prisma.ListingWhereInput = q.status ? { ...where, status: LISTING_FROM_FILTER[q.status] } : where;
  const [rows, total, grouped, rules] = await Promise.all([
    prisma.listing.findMany({ where: filtered, include: cardInclude, orderBy: { createdAt: "asc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.listing.count({ where: filtered }),
    prisma.listing.groupBy({ by: ["status"], where, _count: { _all: true } }),
    setting("listings.quality"),
  ]);
  const n = (s: ListingStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const counts: ListingCounts = {
    all: grouped.reduce((a, g) => a + g._count._all, 0),
    live: n("APPROVED"),
    review: n("UNDER_REVIEW"),
    info: n("NEEDS_INFO"),
    rejected: n("REJECTED"),
    draft: n("DRAFT"),
    paused: n("PAUSED"),
    sold: n("SOLD"),
  };
  return { items: rows.map((l) => toCard(l, owner, rules)), total, counts };
}

export async function getMyListing(owner: Owner, id: string): Promise<ListingDetail> {
  const [l, rules] = await Promise.all([prisma.listing.findFirst({ where: { id, customerId: owner.id, status: { not: "ARCHIVED" } }, include: detailInclude }), setting("listings.quality")]);
  if (!l) throw notFound("We couldn't find that listing.");
  return toDetail(l, owner, rules);
}

export const countMyListings = (ownerId: string) => prisma.listing.count({ where: { customerId: ownerId, status: { not: "ARCHIVED" } } });

// ---------------------------------------------------------------- writes

export async function createListing(owner: Owner, category: ListingCategory): Promise<{ id: string }> {
  const profile = await prisma.customerProfile.findUnique({ where: { userId: owner.id }, select: { regionId: true } });
  const region = (profile?.regionId && (await activeRegionById(profile.regionId))) || (await prisma.region.findFirst({ where: { active: true }, orderBy: { name: "asc" } }));
  if (!region) throw new AppError(503, "Listings are not open in any city yet.");
  return prisma.$transaction(async (tx) => {
    const l = await tx.listing.create({
      data: {
        customerId: owner.id,
        source: owner.kind === "AGENCY" ? "AGENCY_POSTED" : "SELF_POSTED",
        slug: `listing-${crypto.randomBytes(6).toString("hex")}`,
        title: listingTitle(category, null, "MARLA"),
        category,
        sizeUnit: "MARLA",
        regionId: region.id,
        amenities: [],
      },
      select: { id: true },
    });
    await tx.listingStatusEvent.create({ data: { listingId: l.id, status: "DRAFT" } });
    return l;
  });
}

export async function updateListing(owner: Owner, id: string, patch: ListingPatchInput): Promise<ListingDetail> {
  const l = await ownListingRow(owner.id, id);
  if (!canEdit(l)) throw conflict(l.status === "SOLD" ? "This listing is sold." : "This listing is under review. You can edit it after we reply.");

  const data: Prisma.ListingUncheckedUpdateInput = {};
  if (patch.category) data.category = patch.category;
  if (patch.sizeUnit) data.sizeUnit = patch.sizeUnit;
  if (patch.sizeValue !== undefined) data.sizeValue = patch.sizeValue ? new Prisma.Decimal(patch.sizeValue) : null;
  if (patch.bedrooms !== undefined) data.bedrooms = patch.bedrooms;
  if (patch.bathrooms !== undefined) data.bathrooms = patch.bathrooms;
  if (patch.pricePkr !== undefined) data.pricePkr = patch.pricePkr ? BigInt(patch.pricePkr) : null;
  if (patch.addressText !== undefined) data.addressText = patch.addressText || null;
  if (patch.description !== undefined) data.description = patch.description || null;
  if (patch.amenities) data.amenities = patch.amenities;
  if (patch.ownerName !== undefined && owner.kind === "AGENCY") data.ownerName = patch.ownerName || null;

  const regionId = patch.regionId ?? l.regionId;
  if (patch.regionId && patch.regionId !== l.regionId) {
    if (!(await activeRegionById(patch.regionId))) throw badInput({ regionId: "Pick a city from the list." });
    data.regionId = patch.regionId;
    data.localityId = null; // an area belongs to one city
  }
  if (patch.localityId !== undefined) {
    if (patch.localityId && !(await localityInRegion(patch.localityId, regionId))) throw badInput({ localityId: "Pick an area from the list." });
    data.localityId = patch.localityId || null;
  }

  // keep the derived columns in step with what was typed
  const category = (data.category as string | undefined) ?? l.category;
  const unit = (data.sizeUnit as SizeUnit | undefined) ?? (l.sizeUnit as SizeUnit);
  const size = data.sizeValue !== undefined ? (data.sizeValue as Prisma.Decimal | null) : l.sizeValue;
  data.sizeSqft = size ? new Prisma.Decimal(toSqft(Number(size), unit)) : null;
  data.title = listingTitle(category, size, unit);

  // a listing in review or live must stay complete (also a CHECK in the database)
  if (COMPLETE_REQUIRED.includes(l.status) && (data.pricePkr === null || data.sizeValue === null || data.localityId === null)) {
    throw badInput({ form: "A submitted listing needs its price, size and area." });
  }
  // changing the facts we checked sends a live listing back to review (SPEC_02 5.12)
  const live = l.status === "APPROVED" || l.status === "PAUSED";
  const reReview = live && REVIEWED_FIELDS.some((f) => f in data && String(data[f] ?? "") !== String(l[f] ?? ""));
  if (reReview) data.status = "UNDER_REVIEW";

  await prisma.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: l.id }, data });
    if (reReview) {
      await tx.listingStatusEvent.create({ data: { listingId: l.id, status: "UNDER_REVIEW" } });
      await notifyUser(tx, owner.id, "LISTING_IN_REVIEW", { listingId: l.id, listingTitle: data.title as string, localityName: l.locality?.name ?? "" });
    }
  });
  return getMyListing(owner, id);
}

export async function submitListing(owner: Owner, id: string): Promise<{ status: ListingStatus }> {
  const [detail, l] = await Promise.all([getMyListing(owner, id), ownListingRow(owner.id, id)]);
  if (!SUBMITTABLE.includes(l.status)) throw conflict("This listing can't be submitted right now.");
  const { checks } = detail.quality;
  if (checks.some((c) => !c.passed)) throw new AppError(422, "Some checks still fail.", { checks: JSON.stringify(checks) });
  await prisma.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id: l.id },
      data: {
        status: "UNDER_REVIEW",
        criteriaResult: { passed: true, checks: checks.map((c) => ({ key: c.key, passed: c.passed })) },
        // a readable, stable address once the facts are in (only before the first publish)
        ...(l.publishedAt ? {} : { slug: `${slugify(`${l.title} ${l.locality?.name ?? ""}`, "listing")}-${crypto.randomBytes(3).toString("hex")}` }),
      },
    });
    await tx.listingStatusEvent.create({ data: { listingId: l.id, status: "UNDER_REVIEW" } });
    await notifyUser(tx, owner.id, "LISTING_IN_REVIEW", { listingId: l.id, listingTitle: l.title, localityName: l.locality?.name ?? "" });
  });
  return { status: "UNDER_REVIEW" };
}

export async function applyOwnerAction(owner: Owner, id: string, action: OwnerAction): Promise<{ status: ListingStatus }> {
  const rule = OWNER_ACTIONS[action];
  return prisma.$transaction(async (tx) => {
    const l = await ownListingRow(owner.id, id, tx);
    if (!rule.from.includes(l.status)) throw conflict(rule.refusal);
    const now = new Date();
    await tx.listing.update({ where: { id: l.id }, data: { status: rule.to, ...(rule.to === "SOLD" ? { soldAt: now } : {}) } });
    await tx.listingStatusEvent.create({ data: { listingId: l.id, status: rule.to } });
    if (rule.to === "SOLD") await closeOrdersForSoldListing(tx, l.id, now);
    return { status: rule.to };
  });
}

/** A sold listing ends its packages now. Undelivered leads on the running one become cashback (DR-11). */
async function closeOrdersForSoldListing(tx: Prisma.TransactionClient, listingId: string, now: Date) {
  const active = await tx.order.findMany({ where: { listingId, status: "ACTIVE" } });
  for (const o of active) {
    const missing = Math.max(0, o.leadCount - o.deliveredCount);
    await tx.order.update({ where: { id: o.id }, data: { status: missing > 0 ? "EXPIRED" : "COMPLETED", windowEndsAt: now } });
    if (missing > 0) await tx.cashback.create({ data: { orderId: o.id, undeliveredCount: missing, amountPkr: o.pricePerLeadPkr * BigInt(missing) } });
  }
  // a package that hasn't started yet must not start a campaign later
  await tx.jobRequest.deleteMany({ where: { status: "PENDING", dedupeKey: { in: active.map((o) => `campaign-start:${o.id}`) } } });
  await tx.order.updateMany({ where: { listingId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
}

// ---------------------------------------------------------------- photos and documents

export async function addPhoto(owner: Owner, id: string, file: File) {
  const l = await ownListingRow(owner.id, id);
  if (!canEdit(l)) throw conflict("This listing can't be changed right now.");
  const count = await prisma.listingImage.count({ where: { listingId: l.id } });
  if (count >= MAX_PHOTOS) throw conflict(`A listing can have up to ${MAX_PHOTOS} photos.`);
  const stored = await (await mediaStore()).putImage(await preparePhoto(file), `listings/${l.id}`);
  try {
    const image = await prisma.$transaction(async (tx) => {
      const last = await tx.listingImage.aggregate({ where: { listingId: l.id }, _max: { position: true } });
      return tx.listingImage.create({ data: { listingId: l.id, cloudinaryId: stored.id, url: stored.url, position: (last._max.position ?? -1) + 1 }, select: { id: true, url: true, position: true } });
    });
    return { image };
  } catch (e) {
    await (await mediaStore()).remove(stored.id, "image").catch(() => {});
    throw e;
  }
}

export async function deletePhoto(owner: Owner, id: string, imageId: string): Promise<void> {
  const l = await ownListingRow(owner.id, id);
  if (!canEdit(l)) throw conflict("This listing can't be changed right now.");
  const img = await prisma.listingImage.findFirst({ where: { id: imageId, listingId: l.id } });
  if (!img) throw notFound("We couldn't find that photo.");
  await prisma.$transaction(async (tx) => {
    await tx.listingImage.delete({ where: { id: img.id } });
    await renumber(tx, l.id, (await tx.listingImage.findMany({ where: { listingId: l.id }, orderBy: { position: "asc" }, select: { id: true } })).map((i) => i.id));
  });
  await (await mediaStore()).remove(img.cloudinaryId, "image").catch((e) => console.warn("[media] could not remove photo:", String(e).slice(0, 200)));
}

export async function reorderPhotos(owner: Owner, id: string, ids: string[]): Promise<void> {
  const l = await ownListingRow(owner.id, id);
  if (!canEdit(l)) throw conflict("This listing can't be changed right now.");
  const current = await prisma.listingImage.findMany({ where: { listingId: l.id }, select: { id: true } });
  const known = new Set(current.map((i) => i.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((i) => !known.has(i))) throw badInput({ ids: "Send every photo of this listing exactly once." });
  await prisma.$transaction((tx) => renumber(tx, l.id, ids));
}

/** Positions are unique per listing, so move everything out of the way first, then write 0..n. */
async function renumber(tx: Prisma.TransactionClient, listingId: string, ids: string[]) {
  await tx.listingImage.updateMany({ where: { listingId }, data: { position: { increment: 10_000 } } });
  for (const [position, imageId] of ids.entries()) await tx.listingImage.update({ where: { id: imageId }, data: { position } });
}

/** One ownership document per listing: a new upload replaces the old one. */
export async function setDocument(owner: Owner, id: string, kind: DocumentKind, file: File) {
  const l = await ownListingRow(owner.id, id);
  if (!canEdit(l)) throw conflict("This listing can't be changed right now.");
  const fileName = safeFileName(file.name);
  const stored = await (await mediaStore()).putDocument(await prepareDocument(file), `documents/${l.id}`, fileName);
  const old = await prisma.listingDocument.findMany({ where: { listingId: l.id } });
  const doc = await prisma.$transaction(async (tx) => {
    await tx.listingDocument.deleteMany({ where: { listingId: l.id } });
    return tx.listingDocument.create({ data: { listingId: l.id, kind, fileName, cloudinaryId: stored.id }, select: { id: true, kind: true, fileName: true, uploadedAt: true } });
  });
  for (const d of old) await (await mediaStore()).remove(d.cloudinaryId, "document").catch(() => {});
  return { document: { ...doc, uploadedAt: doc.uploadedAt.toISOString() } };
}

// ---------------------------------------------------------------- AI help (SPEC_02 5.12)

/** A suggested rewrite of the description. Nothing is saved: the owner decides. */
export async function aiReview(owner: Owner, id: string): Promise<{ available: boolean; suggestion: DescriptionSuggestion | null }> {
  const l = await ownListingRow(owner.id, id);
  if (!SUBMITTABLE.includes(l.status)) throw conflict("AI help is available before a listing is submitted.");
  if ((l.description ?? "").trim().length < 20) throw badInput({ description: "Write a few lines first; AI improves what you wrote." });
  const suggestion = await suggestDescription({ title: l.title, category: l.category, locality: l.locality?.name ?? "", description: l.description ?? "" });
  return { available: suggestion !== null, suggestion };
}
