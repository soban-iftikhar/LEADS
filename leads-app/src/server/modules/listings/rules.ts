import type { ListingStatus } from "@prisma/client";
import { CATEGORY, SIZE_UNIT } from "@/lib/labels";
import type { ListingCategory, QualityCheck, SizeUnit } from "@/types/api";

/** Square feet per unit. 1 Marla = 225 sq ft, 1 Kanal = 20 Marla (the convention on all four portals). */
const SQFT_PER: Record<SizeUnit, number> = { MARLA: 225, KANAL: 4500, SQFT: 1, SQYD: 9 };

export function toSqft(value: number, unit: SizeUnit): number {
  return Math.round(value * SQFT_PER[unit] * 100) / 100;
}

/** "10 Marla house" — or "New house" while the size is still empty. */
export function listingTitle(category: string, sizeValue: { toString(): string } | null, sizeUnit: string): string {
  const kind = category === "COMMERCIAL" ? "shop" : (CATEGORY[category] ?? category).toLowerCase();
  if (!sizeValue) return `New ${kind}`;
  const size = Number(sizeValue.toString());
  const unit = (SIZE_UNIT[sizeUnit] ?? sizeUnit).replace("Sq", "sq");
  return `${Number.isInteger(size) ? size : size.toFixed(2).replace(/0+$/, "")} ${unit} ${kind}`;
}

// ---------------------------------------------------------------- status changes (SPEC_02 5.12)

/** Statuses the owner may edit in. Changing core facts of a live listing sends it back to review. */
export const EDITABLE: readonly ListingStatus[] = ["DRAFT", "NEEDS_INFO", "REJECTED", "APPROVED", "PAUSED"];
export const SUBMITTABLE: readonly ListingStatus[] = ["DRAFT", "NEEDS_INFO", "REJECTED"];

export type OwnerAction = "pause" | "resume" | "mark-sold";
export const OWNER_ACTIONS: Record<OwnerAction, { from: readonly ListingStatus[]; to: ListingStatus; refusal: string }> = {
  pause: { from: ["APPROVED"], to: "PAUSED", refusal: "Only live listings can be paused." },
  resume: { from: ["PAUSED"], to: "APPROVED", refusal: "Only paused listings can be resumed." },
  "mark-sold": { from: ["APPROVED", "PAUSED"], to: "SOLD", refusal: "Only live or paused listings can be marked sold." },
};

/** Fields whose change on a live listing needs a fresh review. */
export const REVIEWED_FIELDS = ["category", "sizeValue", "sizeUnit", "pricePkr", "localityId", "regionId"] as const;

// ---------------------------------------------------------------- quality gate (DR-09; parameters open, OQ-14)

export type QualityRules = { minPhotos: number; minDescription: number };
export const DEFAULT_QUALITY: QualityRules = { minPhotos: 5, minDescription: 40 };

type QualityInput = {
  category: ListingCategory | string;
  sizeValue: unknown;
  localityId: string | null;
  pricePkr: bigint | null;
  description: string | null;
  photos: number;
  documents: number;
  phoneVerified: boolean;
};

export function qualityChecks(l: QualityInput, rules: QualityRules): QualityCheck[] {
  const missingPhotos = Math.max(0, rules.minPhotos - l.photos);
  const checks: (Omit<QualityCheck, "hint"> & { hint: string })[] = [
    { key: "basics", label: "Type, size, location", passed: !!(l.category && l.sizeValue && l.localityId), hint: "Add the size and pick the area." },
    { key: "price", label: "Price", passed: !!l.pricePkr && l.pricePkr > BigInt(0), hint: "Add your asking price." },
    { key: "description", label: "Description", passed: (l.description ?? "").trim().length >= rules.minDescription, hint: `Write at least ${rules.minDescription} characters.` },
    { key: "photos", label: `${rules.minPhotos} photos`, passed: missingPhotos === 0, hint: `Add ${missingPhotos} more ${missingPhotos === 1 ? "photo" : "photos"}.` },
    { key: "ownership_doc", label: "Ownership document", passed: l.documents > 0, hint: "Upload the registry, transfer or allotment letter." },
    { key: "whatsapp", label: "WhatsApp number", passed: l.phoneVerified, hint: "Verify your WhatsApp number." },
  ];
  return checks.map((c) => ({ ...c, hint: c.passed ? null : c.hint }));
}

/** Share of passed checks, 0-100. */
export function qualityScore(checks: QualityCheck[]): number {
  return Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
}
