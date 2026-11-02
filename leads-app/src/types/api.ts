// Shapes of the UI <-> backend contract. Any change goes into the contract first.

export type Pkr = string; // BigInt sent as a string

export type ApiOk<T> = { success: true; data: T };
export type ApiErr = { success: false; message: string; errors: Record<string, string> | null };
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export type Role = "CUSTOMER_SELLER" | "CUSTOMER_AGENCY";
export type CustomerKind = "SELLER" | "AGENCY";

export type Me = {
  user: { id: string; email: string; role: Role; phoneMasked: string | null; emailVerified: boolean; phoneVerified: boolean };
  customer: { kind: CustomerKind; displayName: string; contactPerson: string | null; initials: string };
  counts: { newLeads: number; unreadNotifications: number; listings: number };
};

export type ListingStatus = "DRAFT" | "UNDER_REVIEW" | "NEEDS_INFO" | "APPROVED" | "REJECTED" | "PAUSED" | "SOLD" | "ARCHIVED";
export type ListingCategory = "HOUSE" | "PLOT" | "FLAT" | "COMMERCIAL";
export type SizeUnit = "MARLA" | "KANAL" | "SQFT" | "SQYD";

export type ListingCard = {
  id: string;
  slug: string;
  title: string;
  category: ListingCategory;
  locality: { id: string; name: string; regionName: string };
  pricePkr: Pkr;
  sizeValue: string;
  sizeUnit: SizeUnit;
  status: ListingStatus;
  qualityScore: number | null;
  leadCount: number;
  createdAt: string;
  activeOrder: { id: string; planName: string; leadCount: number; deliveredCount: number; windowEndsAt: string; daysLeft: number } | null;
  coverUrl: string | null;
};

export type QualityCheck = { key: string; label: string; passed: boolean; hint: string | null };

export type DocumentKind = "REGISTRY" | "TRANSFER_LETTER" | "ALLOTMENT_LETTER";

export type ListingDetail = ListingCard & {
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  addressText: string | null;
  amenities: string[];
  images: { id: string; url: string; position: number }[];
  documents: { id: string; kind: DocumentKind; fileName: string; uploadedAt: string }[];
  quality: { checks: QualityCheck[]; passed: number; total: number };
  benchmark: { minPkr: Pkr; maxPkr: Pkr; sampleSize: number } | null;
  reviews: { decision: string; note: string | null; createdAt: string }[];
  timeline: { status: ListingStatus; at: string }[];
};

export type ListingPatch = Partial<{
  title: string;
  category: ListingCategory;
  sizeValue: string;
  sizeUnit: SizeUnit;
  bedrooms: number | null;
  bathrooms: number | null;
  pricePkr: Pkr;
  regionId: string;
  localityId: string;
  addressText: string;
  description: string;
  amenities: string[];
}>;

export type ListingCounts = { all: number; live: number; review: number; info: number; rejected: number; draft: number; paused: number; sold: number };

export type CustomerStage = "NEW" | "CONTACTED" | "VIEWING" | "CLOSED_WON" | "CLOSED_LOST";
export type LeadStatus = "ACTIVE" | "REPORTED" | "REPORT_UPHELD" | "REPORT_REJECTED";
export type LeadSource = "CAMPAIGN_REPLY" | "CAMPAIGN_FORM" | "BUYER_INQUIRY";
export type ReportReason = "WRONG_NUMBER" | "NEVER_REPLIED" | "NOT_BUYING" | "IS_AGENT" | "DUPLICATE" | "OTHER";
export type ReportStatus = "OPEN" | "UPHELD" | "REJECTED";

export type LeadListItem = {
  id: string;
  buyerName: string;
  initials: string;
  phone: string;
  listing: { id: string; title: string; localityName: string };
  said: string | null;
  budgetMinPkr: Pkr | null;
  budgetMaxPkr: Pkr | null;
  timeline: string | null;
  source: LeadSource;
  customerStage: CustomerStage;
  status: LeadStatus;
  deliveredAt: string;
};

export type LeadStageFilter = "new" | "contacted" | "viewing" | "won" | "lost" | "reported";
export type LeadCounts = { all: number; new: number; contacted: number; viewing: number; won: number; lost: number; reported: number };

export type LeadDetail = LeadListItem & {
  note: string | null;
  followUpAt: string | null;
  order: { id: string; planName: string; deliveredCount: number; leadCount: number } | null;
  conversation: { direction: "OUT" | "IN"; body: string; at: string }[];
  activity: { at: string; text: string }[];
  report: { status: ReportStatus; reason: ReportReason; details: string | null } | null;
  reportableUntil: string;
};

export type OrderStatus = "PENDING_PAYMENT" | "ACTIVE" | "COMPLETED" | "EXPIRED" | "CANCELLED" | "FAILED";
export type CashbackStatus = "PENDING" | "PAID" | "FAILED";

export type OrderCard = {
  id: string;
  status: OrderStatus;
  planName: string;
  leadCount: number;
  deliveredCount: number;
  pricePkr: Pkr;
  pricePerLeadPkr: Pkr;
  windowStartsAt: string | null;
  windowEndsAt: string | null;
  daysLeft: number | null;
  listing: { id: string; title: string; localityName: string; category: string };
  cashback: { status: CashbackStatus; undeliveredCount: number; amountPkr: Pkr; paidAt: string | null } | null;
};

export type PaymentMethod = "CARD" | "JAZZCASH" | "EASYPAISA" | "BANK_TRANSFER";

export type OrderDetail = OrderCard & {
  payments: { status: string; provider: string; createdAt: string }[];
  startsAt: string;
};

export type PayResult =
  | { redirectUrl: string }
  | { instructions: { bank: string; accountTitle: string; iban: string; reference: string } };

export type PackagePlan = { id: string; name: string; leadCount: number; pricePkr: Pkr; pricePerLeadPkr: Pkr; deliveryDays: number };

export type DashboardSummary = {
  activeOrders: number;
  delivered: number;
  bought: number;
  nextEnding: { orderId: string; windowEndsAt: string; daysLeft: number; listingTitle: string } | null;
  leadsToCall: number;
  oldestNewLeadAt: string | null;
};

export type NotificationType =
  | "LEAD_DELIVERED"
  | "LISTING_IN_REVIEW"
  | "LISTING_APPROVED"
  | "LISTING_NEEDS_INFO"
  | "LISTING_REJECTED"
  | "ORDER_STARTED"
  | "ORDER_ENDING"
  | "ORDER_ENDED"
  | "CASHBACK_PAID"
  | "REPORT_DECIDED";

export type NotificationItem = { id: string; type: NotificationType; title: string; body: string; href: string; createdAt: string; readAt: string | null };

export type NotificationSettings = {
  newLeadWhatsapp: boolean;
  dailySummary: boolean;
  listingUpdates: boolean;
  emailCopies: boolean;
  packageEnding: boolean;
};

export type Locality = { id: string; name: string; slug: string; parentName: string | null };

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
