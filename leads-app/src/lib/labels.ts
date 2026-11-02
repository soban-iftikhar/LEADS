// Enum -> label and chip tone. The single mapping used by every screen.
import type { ChipTone } from "@/components/ui/Chip";
import type {
  CashbackStatus,
  CustomerKind,
  CustomerStage,
  LeadSource,
  LeadStageFilter,
  LeadStatus,
  ListingStatus,
  OrderStatus,
  ReportReason,
} from "@/types/api";

type Label = { label: string; tone: ChipTone };

export const LISTING_STATUS: Record<Exclude<ListingStatus, "ARCHIVED">, Label> = {
  DRAFT: { label: "Draft", tone: "draft" },
  UNDER_REVIEW: { label: "Under review", tone: "review" },
  NEEDS_INFO: { label: "Needs info", tone: "info" },
  APPROVED: { label: "Live", tone: "live" },
  REJECTED: { label: "Rejected", tone: "rej" },
  PAUSED: { label: "Paused", tone: "review" },
  SOLD: { label: "Sold", tone: "sold" },
};

export const CUSTOMER_STAGE: Record<CustomerStage, Label> = {
  NEW: { label: "New", tone: "new" },
  CONTACTED: { label: "Contacted", tone: "cont" },
  VIEWING: { label: "Viewing", tone: "visit" },
  CLOSED_WON: { label: "Won", tone: "deal" },
  CLOSED_LOST: { label: "Lost", tone: "lost" },
};

/** Report states replace the stage chip; a rejected report keeps the stage chip. */
export function leadChip(stage: CustomerStage, status: LeadStatus): Label {
  if (status === "REPORTED") return { label: "Reported", tone: "bad" };
  if (status === "REPORT_UPHELD") return { label: "Refunded", tone: "lost" };
  return CUSTOMER_STAGE[stage];
}

export const LEAD_SOURCE: Record<LeadSource, string> = {
  CAMPAIGN_REPLY: "WhatsApp reply",
  CAMPAIGN_FORM: "Property form",
  BUYER_INQUIRY: "Asked on LEADS",
};

export const ORDER_STATUS: Record<OrderStatus, Label> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "draft" },
  ACTIVE: { label: "Active", tone: "live" },
  COMPLETED: { label: "Completed", tone: "cont" },
  EXPIRED: { label: "Expired", tone: "cont" },
  CANCELLED: { label: "Cancelled", tone: "lost" },
  FAILED: { label: "Payment failed", tone: "info" },
};

export function cashbackChip(status: CashbackStatus, undelivered: number): Label {
  if (status === "PAID") return { label: `Paid · ${undelivered} leads`, tone: "live" };
  if (status === "FAILED") return { label: "Cashback failed, we're on it", tone: "info" };
  return { label: "Cashback pending", tone: "review" };
}

export const CUSTOMER_KIND: Record<CustomerKind, string> = { SELLER: "Owner", AGENCY: "Agency" };

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "NEVER_REPLIED", label: "Says they never replied" },
  { value: "NOT_BUYING", label: "Not looking to buy" },
  { value: "IS_AGENT", label: "Is an agent, not a buyer" },
  { value: "DUPLICATE", label: "Duplicate of another lead" },
  { value: "OTHER", label: "Other" },
];

/** URL filter value -> stage, and back. */
export const STAGE_FILTERS: { value: LeadStageFilter | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "viewing", label: "Viewing" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "reported", label: "Reported" },
];

export const STAGE_FROM_FILTER: Record<Exclude<LeadStageFilter, "reported">, CustomerStage> = {
  new: "NEW",
  contacted: "CONTACTED",
  viewing: "VIEWING",
  won: "CLOSED_WON",
  lost: "CLOSED_LOST",
};

export type ListingFilter = "live" | "review" | "info" | "rejected" | "draft" | "paused" | "sold";
export const LISTING_FROM_FILTER: Record<ListingFilter, ListingStatus> = {
  live: "APPROVED",
  review: "UNDER_REVIEW",
  info: "NEEDS_INFO",
  rejected: "REJECTED",
  draft: "DRAFT",
  paused: "PAUSED",
  sold: "SOLD",
};

export const SIZE_UNIT: Record<string, string> = { MARLA: "Marla", KANAL: "Kanal", SQFT: "Sq ft", SQYD: "Sq yd" };

export const CATEGORY: Record<string, string> = { HOUSE: "House", PLOT: "Plot", FLAT: "Flat", COMMERCIAL: "Commercial" };
