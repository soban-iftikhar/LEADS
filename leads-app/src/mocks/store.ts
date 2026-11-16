// In-memory stand-in for the backend while the contract endpoints are being built.
// TODO(api): delete this folder once every endpoint in the contract exists.
// Shapes match src/types/api.ts exactly. Every read is scoped to the signed-in customer.
import "server-only";
import type {
  FollowUpKind,
  CustomerKind,
  CustomerStage,
  DashboardSummary,
  DocumentKind,
  LeadCounts,
  LeadDetail,
  LeadListItem,
  LeadSource,
  LeadStageFilter,
  LeadStatus,
  ListingCard,
  ListingCategory,
  ListingCounts,
  ListingDetail,
  ListingPatch,
  ListingStatus,
  Locality,
  Me,
  NotificationItem,
  NotificationType,
  OrderCard,
  OrderDetail,
  OrderStatus,
  PackagePlan,
  PaymentMethod,
  PayResult,
  QualityCheck,
  ReportReason,
  SizeUnit,
} from "@/types/api";

const MIN = 60_000;
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
/** Calendar day in Asia/Karachi (UTC+5, no DST). */
const karachiDay = (t: number) => {
  const d = new Date(t + 5 * 3_600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: (d.getUTCDay() + 6) % 7 };
};
/** UTC ms of 00:00 Karachi on the day containing t. */
const karachiMidnight = (t: number) => {
  const k = karachiDay(t);
  return Date.UTC(k.y, k.m, k.d) - 5 * 3_600_000;
};
const daysLeft = (end: string) => Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / DAY));
let seq = 1000;
const uid = (p: string) => `${p}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export class MockError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string> | null = null,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- reference data

export const REGIONS = [
  { id: "reg_isb", slug: "islamabad", name: "Islamabad" },
  { id: "reg_rwp", slug: "rawalpindi", name: "Rawalpindi" },
] as const;

const LOCALITIES: (Locality & { regionId: string })[] = [
  ["G-13/1", "g-13-1", "G-13"], ["G-13/2", "g-13-2", "G-13"], ["G-13/3", "g-13-3", "G-13"], ["G-13", "g-13", null],
  ["G-14/4", "g-14-4", "G-14"], ["G-14", "g-14", null], ["B-17", "b-17", null], ["F-11/1", "f-11-1", "F-11"], ["F-11", "f-11", null],
  ["E-11", "e-11", null], ["DHA Phase 2", "dha-phase-2", "DHA"], ["I-8", "i-8", null], ["G-11", "g-11", null],
].map(([name, slug, parent]) => ({ id: `loc_${slug}`, name: name as string, slug: slug as string, parentName: parent, regionId: "reg_isb" }))
  .concat(
    [
      ["Bahria Town Phase 8", "bahria-town", "Bahria Town"], ["Bahria Town Phase 7", "bahria-town-phase-7", "Bahria Town"], ["Gulraiz", "gulraiz", null],
      ["Satellite Town", "satellite-town", null], ["Adiala Road", "adiala-road", null], ["Saddar", "saddar", null], ["Chaklala Scheme 3", "chaklala-scheme-3", null],
    ].map(([name, slug, parent]) => ({ id: `loc_${slug}`, name: name as string, slug: slug as string, parentName: parent, regionId: "reg_rwp" })),
  );

const PLANS: PackagePlan[] = [
  { id: "plan_starter", name: "Starter", leadCount: 25, pricePkr: "12500", pricePerLeadPkr: "500", deliveryDays: 60 },
  { id: "plan_growth", name: "Growth", leadCount: 100, pricePkr: "40000", pricePerLeadPkr: "400", deliveryDays: 60 },
  { id: "plan_agency", name: "Agency", leadCount: 250, pricePkr: "87500", pricePerLeadPkr: "350", deliveryDays: 60 },
];

// ---------------------------------------------------------------- state shapes

type User = {
  id: string;
  customerId: string;
  email: string;
  kind: CustomerKind;
  displayName: string;
  contactPerson: string | null;
  phoneVerified: boolean;
  deleted: boolean;
  /** Owner profile city (region slug). TODO(api): not in Me / PATCH /api/me yet. */
  city?: string | null;
};

type Listing = {
  id: string;
  customerId: string;
  slug: string;
  category: ListingCategory;
  sizeValue: string;
  sizeUnit: SizeUnit;
  bedrooms: number | null;
  bathrooms: number | null;
  pricePkr: string;
  regionId: string;
  localityId: string | null;
  addressText: string | null;
  description: string;
  amenities: string[];
  ownerName?: string | null;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  images: { id: string; url: string; position: number }[];
  documents: { id: string; kind: DocumentKind; fileName: string; uploadedAt: string }[];
  reviews: { decision: string; note: string | null; createdAt: string }[];
  timeline: { status: ListingStatus; at: string }[];
};

type Lead = {
  id: string;
  customerId: string;
  listingId: string;
  orderId: string | null;
  buyerName: string;
  phone: string;
  said: string | null;
  budgetMinPkr: string | null;
  budgetMaxPkr: string | null;
  timeline: string | null;
  source: LeadSource;
  customerStage: CustomerStage;
  status: LeadStatus;
  deliveredAt: string;
  note: string | null;
  followUpAt: string | null;
  followUpKind: FollowUpKind | null;
  conversation: { direction: "OUT" | "IN"; body: string; at: string }[];
  activity: { at: string; text: string }[];
  report: { status: "OPEN" | "UPHELD" | "REJECTED"; reason: ReportReason; details: string | null } | null;
};

type Order = {
  id: string;
  customerId: string;
  listingId: string;
  planId: string;
  status: OrderStatus;
  leadCount: number;
  deliveredCount: number;
  pricePkr: string;
  pricePerLeadPkr: string;
  windowStartsAt: string | null;
  windowEndsAt: string | null;
  createdAt: string;
  cashback: OrderCard["cashback"];
  payments: { status: string; provider: string; createdAt: string }[];
  /** Mock only: when payment "succeeds" (the return page polls until then). */
  paidAt: number | null;
};

type Notification = NotificationItem & { customerId: string };

type DB = { users: User[]; listings: Listing[]; leads: Lead[]; orders: Order[]; notifications: Notification[] };

// ---------------------------------------------------------------- seed


const DESC =
  "Corner house on a 40 ft road, 5 bedrooms with attached baths, double kitchen, servant quarter and a small lawn. Near the G-13 markaz and the Kashmir Highway.";

const BUYERS = [
  ["Bilal Ahmed", "+923001234567", '"Ji, interested. Corner hai?"', 28, 32, "Buying in 1–3 months"],
  ["Sana Khan", "+923217654321", '"Kab dekh sakte hain? Weekend ok?"', 17, 20, "Ready this month"],
  ["Usman Farooq", "+923335550192", null, 42, 48, "Buying in 3–6 months"],
  ["Ayesha Malik", "+923452223344", '"Price negotiable hai?"', 29, 31, "Buying in 1–3 months"],
  ["Hamza Qureshi", "+923129087766", '"Interested. Send more pictures"', 18, 21, "Ready this month"],
  ["Fatima Zahra", "+923004455667", '"Yes, call me after 6pm"', 45, 50, "Buying in 1–3 months"],
  ["Ali Raza", "+923011112233", '"Haan dekhna hai"', 30, 33, "Buying in 3–6 months"],
  ["Omer Sheikh", "+923228889990", '"Wrong number, I never asked"', null, null, null],
] as const;

const MORE_NAMES = [
  "Zainab Hussain", "Kashif Mehmood", "Nadia Iqbal", "Faisal Javed", "Hira Aslam", "Imran Shah", "Saad Butt", "Maryam Tariq",
  "Adeel Akhtar", "Rabia Noor", "Waqas Anwar", "Sobia Khalid", "Tariq Bashir", "Mehwish Ali", "Junaid Siddiqui", "Asma Rehman",
];

function seed(): DB {
  const now = Date.now();
  const user: User = {
    id: "usr_demo",
    customerId: "cus_demo",
    email: "demo@leads.pk",
    kind: "AGENCY",
    displayName: "Al-Noor Estate",
    contactPerson: "Imran Qureshi",
    phoneVerified: true,
    deleted: false,
  };
  const C = user.customerId;
  const mkListing = (
    id: string,
    category: ListingCategory,
    size: string,
    unit: SizeUnit,
    price: string,
    loc: string,
    region: string,
    status: ListingStatus,
    createdDaysAgo: number,
    photos: number,
    doc: boolean,
    beds: number | null,
  ): Listing => {
    const created = now - createdDaysAgo * DAY;
    const timeline: Listing["timeline"] = [{ status: "UNDER_REVIEW", at: iso(created + 30 * MIN) }];
    if (status !== "UNDER_REVIEW") timeline.push({ status, at: iso(created + DAY / 2) });
    return {
      id,
      customerId: C,
      slug: `${size}-${unit.toLowerCase()}-${category.toLowerCase()}-${loc}`.replace(/[^a-z0-9-]/g, "-") + "-" + id.slice(-4),
      category,
      sizeValue: size,
      sizeUnit: unit,
      bedrooms: beds,
      bathrooms: beds ? beds - 1 : null,
      pricePkr: price,
      regionId: region,
      localityId: `loc_${loc}`,
      addressText: null,
      description: DESC,
      amenities: [],
      status,
      createdAt: iso(created),
      updatedAt: iso(created),
      images: Array.from({ length: photos }, (_, n) => ({ id: `img_${id}_${n}`, url: "", position: n })),
      documents: doc ? [{ id: `doc_${id}`, kind: "REGISTRY", fileName: "registry-scan.pdf", uploadedAt: iso(created) }] : [],
      reviews: [],
      timeline,
    };
  };
  const listings: Listing[] = [
    mkListing("lst_g13", "HOUSE", "10", "MARLA", "31000000", "g-13-2", "reg_isb", "APPROVED", 32, 8, true, 5),
    mkListing("lst_dha", "PLOT", "1", "KANAL", "46000000", "dha-phase-2", "reg_isb", "APPROVED", 26, 6, true, null),
    mkListing("lst_bahria", "HOUSE", "5", "MARLA", "19000000", "bahria-town", "reg_rwp", "APPROVED", 23, 7, true, 3),
    mkListing("lst_b17", "HOUSE", "8", "MARLA", "24000000", "b-17", "reg_isb", "NEEDS_INFO", 9, 6, false, 4),
    mkListing("lst_gulraiz", "HOUSE", "7", "MARLA", "16000000", "gulraiz", "reg_rwp", "UNDER_REVIEW", 2, 6, true, 3),
    mkListing("lst_adiala", "PLOT", "10", "MARLA", "8500000", "adiala-road", "reg_rwp", "REJECTED", 11, 2, true, null),
  ];
  listings[3].reviews.push({ decision: "NEEDS_INFO", note: "Please upload the registry or transfer letter. We can't put the listing live without proof of ownership.", createdAt: iso(now - 8 * DAY) });
  listings[5].reviews.push({ decision: "REJECTED", note: "The photos show a built house but the listing is a plot. Please upload photos of the plot itself.", createdAt: iso(now - 10 * DAY) });

  const orders: Order[] = [
    { id: "ord_g13", customerId: C, listingId: "lst_g13", planId: "plan_growth", status: "ACTIVE", leadCount: 100, deliveredCount: 64, pricePkr: "40000", pricePerLeadPkr: "400", windowStartsAt: iso(now - 37 * DAY), windowEndsAt: iso(now + 23 * DAY), createdAt: iso(now - 37 * DAY), cashback: null, payments: [{ status: "SUCCEEDED", provider: "JAZZCASH", createdAt: iso(now - 37 * DAY) }], paidAt: now - 37 * DAY },
    { id: "ord_bahria", customerId: C, listingId: "lst_bahria", planId: "plan_starter", status: "ACTIVE", leadCount: 25, deliveredCount: 23, pricePkr: "12500", pricePerLeadPkr: "500", windowStartsAt: iso(now - 25 * DAY), windowEndsAt: iso(now + 35 * DAY), createdAt: iso(now - 25 * DAY), cashback: null, payments: [{ status: "SUCCEEDED", provider: "CARD", createdAt: iso(now - 25 * DAY) }], paidAt: now - 25 * DAY },
    { id: "ord_dha", customerId: C, listingId: "lst_dha", planId: "plan_starter", status: "ACTIVE", leadCount: 25, deliveredCount: 17, pricePkr: "12500", pricePerLeadPkr: "500", windowStartsAt: iso(now - 12 * DAY), windowEndsAt: iso(now + 48 * DAY), createdAt: iso(now - 12 * DAY), cashback: null, payments: [{ status: "SUCCEEDED", provider: "EASYPAISA", createdAt: iso(now - 12 * DAY) }], paidAt: now - 12 * DAY },
    { id: "ord_old1", customerId: C, listingId: "lst_g13", planId: "plan_starter", status: "COMPLETED", leadCount: 25, deliveredCount: 25, pricePkr: "12500", pricePerLeadPkr: "500", windowStartsAt: iso(now - 100 * DAY), windowEndsAt: iso(now - 40 * DAY), createdAt: iso(now - 100 * DAY), cashback: null, payments: [], paidAt: now - 100 * DAY },
    { id: "ord_old2", customerId: C, listingId: "lst_bahria", planId: "plan_starter", status: "EXPIRED", leadCount: 25, deliveredCount: 21, pricePkr: "12500", pricePerLeadPkr: "500", windowStartsAt: iso(now - 156 * DAY), windowEndsAt: iso(now - 96 * DAY), createdAt: iso(now - 156 * DAY), cashback: { status: "PAID", undeliveredCount: 4, amountPkr: "2000", paidAt: iso(now - 91 * DAY) }, payments: [], paidAt: now - 156 * DAY },
  ];

  const leads: Lead[] = [];
  const listingFor = ["lst_g13", "lst_bahria", "lst_dha", "lst_g13", "lst_bahria", "lst_dha", "lst_g13", "lst_bahria"];
  const stages: CustomerStage[] = ["NEW", "NEW", "NEW", "CONTACTED", "VIEWING", "CLOSED_WON", "CONTACTED", "CONTACTED"];
  const when = [12 * MIN, 2 * 60 * MIN, 5 * 60 * MIN, 26 * 60 * MIN, 30 * 60 * MIN, 2 * DAY, 3 * DAY, 4 * DAY];
  const mkLead = (n: number, name: string, phone: string, said: string | null, bmin: number | null, bmax: number | null, tl: string | null, listingId: string, stage: CustomerStage, at: number, status: LeadStatus = "ACTIVE"): Lead => {
    const order = orders.find((o) => o.listingId === listingId && o.status === "ACTIVE") ?? null;
    const l = listings.find((x) => x.id === listingId)!;
    const loc = LOCALITIES.find((x) => x.id === l.localityId)!;
    const first = name.split(" ")[0];
    const source: LeadSource = said ? "CAMPAIGN_REPLY" : "CAMPAIGN_FORM";
    const sent = at - 22 * MIN;
    return {
      id: `led_${(20481 - n).toString()}`,
      customerId: C,
      listingId,
      orderId: order?.id ?? null,
      buyerName: name,
      phone,
      said: said ?? "Filled in the property form",
      budgetMinPkr: bmin ? String(bmin * 1_000_000) : null,
      budgetMaxPkr: bmax ? String(bmax * 1_000_000) : null,
      timeline: tl,
      source,
      customerStage: stage,
      status,
      deliveredAt: iso(at),
      note: null,
      followUpAt: null,
      followUpKind: null,
      conversation: [
        { direction: "OUT", body: `Assalam o alaikum. A ${l.sizeValue} ${l.sizeUnit === "KANAL" ? "Kanal" : "Marla"} ${l.category === "PLOT" ? "plot" : "house"} in ${loc.name} is for sale${l.bedrooms ? `, ${l.bedrooms} bed` : ""}, PKR ${(Number(l.pricePkr) / 10_000_000).toFixed(1)} Cr. Interested?`, at: iso(sent) },
        ...(said ? [{ direction: "IN" as const, body: said.replace(/^"|"$/g, ""), at: iso(at) }] : []),
      ],
      activity: [
        { at: iso(at), text: order ? `Lead delivered to you · counts toward ${PLANS.find((p) => p.id === order.planId)!.name} package (${order.deliveredCount}/${order.leadCount})` : "Lead delivered to you" },
        { at: iso(at), text: said ? `${first} replied "interested"` : `${first} filled in the property form` },
        { at: iso(sent), text: `We sent ${first} your listing on WhatsApp` },
      ],
      report: status === "REPORTED" ? { status: "OPEN", reason: "WRONG_NUMBER", details: "He said he never got our message" } : null,
    };
  };
  BUYERS.forEach(([name, phone, said, bmin, bmax, tl], n) => {
    leads.push(mkLead(n, name, phone, said, bmin, bmax, tl, listingFor[n], stages[n], now - when[n], n === 7 ? "REPORTED" : "ACTIVE"));
  });
  // today's follow-ups, as on the overview screens
  const k = karachiDay(now);
  ([[4, 16, 0, "VISIT"], [5, 18, 0, "CALL"], [6, 19, 30, "CALL"]] as const).forEach(([n, h, m, kind]) => {
    leads[n].followUpAt = iso(Date.UTC(k.y, k.m, k.d, h - 5, m));
    leads[n].followUpKind = kind;
  });
  // older delivered leads so the list has pages
  const moreStages: CustomerStage[] = ["CONTACTED", "CONTACTED", "VIEWING", "CLOSED_LOST", "CONTACTED", "VIEWING", "CLOSED_WON", "CONTACTED"];
  for (let n = 0; n < 56; n++) {
    const name = MORE_NAMES[n % MORE_NAMES.length];
    const phone = `+9230${(10000000 + n * 7919).toString().slice(0, 8)}`;
    const said = n % 3 === 2 ? null : ['"Interested, details bhejein"', '"Is it still available?"', '"Visit kab ho sakti hai?"'][n % 3];
    const lid = ["lst_g13", "lst_bahria", "lst_dha"][n % 3];
    leads.push(mkLead(8 + n, name, phone, said, 15 + (n % 20), 18 + (n % 20), n % 2 ? "Buying in 1–3 months" : "Buying in 3–6 months", lid, moreStages[n % 8], now - (5 + n * 0.6) * DAY, n === 11 ? "REPORT_REJECTED" : "ACTIVE"));
  }

  const N = (type: NotificationType, title: string, body: string, href: string, at: number, read: boolean): Notification => ({
    id: uid("ntf"),
    customerId: C,
    type,
    title,
    body,
    href,
    createdAt: iso(at),
    readAt: read ? iso(at + MIN) : null,
  });
  const notifications: Notification[] = [
    N("LEAD_DELIVERED", "New lead: Bilal Ahmed", '10 Marla house, G-13/2 · "Ji, interested. Corner hai?"', `/leads/${leads[0].id}`, now - 12 * MIN, false),
    N("LEAD_DELIVERED", "New lead: Sana Khan", '5 Marla house, Bahria Town Ph 8 · "Kab dekh sakte hain?"', `/leads/${leads[1].id}`, now - 2 * 60 * MIN, false),
    N("LEAD_DELIVERED", "New lead: Usman Farooq", "1 Kanal plot, DHA Phase 2", `/leads/${leads[2].id}`, now - 26 * 60 * MIN, true),
    N("LISTING_IN_REVIEW", "7 Marla house is in review", "Gulraiz · usually done within 24 hours", "/listings/lst_gulraiz", now - 2 * DAY + 2 * 60 * MIN, true),
    N("LISTING_NEEDS_INFO", "8 Marla house needs info", "B-17 · upload the ownership document", "/listings/lst_b17", now - 8 * DAY, true),
    N("LISTING_REJECTED", "10 Marla plot was rejected", "Adiala Road · photos did not match the plot", "/listings/lst_adiala", now - 10 * DAY, true),
    N("ORDER_STARTED", "Growth package started", "100 leads over 60 days, ends " + new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Karachi" }).format(new Date(now + 23 * DAY)), "/packages", now - 37 * DAY, true),
  ];

  // Owner demo (owner@leads.pk): the one G-13 house, its package and its leads, as on the ow-* screens
  const O = "cus_owner";
  const owner: User = { id: "usr_owner", customerId: O, email: "owner@leads.pk", kind: "SELLER", displayName: "Soban Iftikhar", contactPerson: null, phoneVerified: true, deleted: false, city: "islamabad" };
  const owListing: Listing = { ...structuredClone(listings[0]), id: "lst_ow_g13", customerId: O, slug: `${listings[0].slug}-ow` };
  const owOrders: Order[] = orders.filter((o) => o.listingId === "lst_g13").map((o) => ({ ...structuredClone(o), id: `${o.id}_ow`, customerId: O, listingId: owListing.id }));
  // the eight headline buyers (as on the ow-* screens) plus the older G-13 ones
  const owOrder = owOrders.find((o) => o.status === "ACTIVE") ?? null;
  const owLeads: Lead[] = leads
    .filter((l, i) => i < BUYERS.length || l.listingId === "lst_g13")
    .map((l) => {
      const c: Lead = { ...structuredClone(l), id: l.id.replace("led_", "led_o"), customerId: O, listingId: owListing.id, orderId: owOrder?.id ?? null };
      if (owOrder) c.activity[0] = { ...c.activity[0], text: `Lead delivered to you · counts toward Growth package (${owOrder.deliveredCount}/${owOrder.leadCount})` };
      c.conversation = c.conversation.map((m) => (m.direction === "OUT" ? { ...m, body: leads[0].conversation[0].body } : m));
      return c;
    });
  const owNotes: Notification[] = [
    N("LEAD_DELIVERED", `New lead: ${owLeads[0].buyerName}`, `10 Marla house, G-13/2 · ${owLeads[0].said ?? ""}`, `/leads/${owLeads[0].id}`, now - 12 * MIN, false),
    N("LISTING_APPROVED", "10 Marla house is live", "G-13/2 · buyers can now get your listing", `/listings/${owListing.id}`, now - 31 * DAY, true),
    N("ORDER_STARTED", "Growth package started", "100 leads over 60 days", "/packages", now - 37 * DAY, true),
  ].map((n) => ({ ...n, customerId: O }));

  return {
    users: [user, owner],
    listings: [...listings, owListing],
    leads: [...leads, ...owLeads],
    orders: [...orders, ...owOrders],
    notifications: [...notifications, ...owNotes],
  };
}

// Survives hot reloads in dev; one copy per server process.
const g = globalThis as unknown as { __leadsMockDb?: DB };
function db(): DB {
  if (!g.__leadsMockDb) g.__leadsMockDb = seed();
  return g.__leadsMockDb;
}

// ---------------------------------------------------------------- helpers

function initialsOf(name: string): string {
  const parts = name.replace(/[^A-Za-z\s-]/g, " ").trim().split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}
function userById(id: string): User {
  const u = db().users.find((x) => x.id === id && !x.deleted);
  if (!u) throw new MockError(401, "Please log in again.");
  return u;
}
function locality(id: string | null) {
  return LOCALITIES.find((l) => l.id === id) ?? null;
}
function regionName(id: string) {
  return REGIONS.find((r) => r.id === id)?.name ?? "";
}
function titleOf(l: Listing): string {
  const unit = l.sizeUnit === "KANAL" ? "Kanal" : l.sizeUnit === "MARLA" ? "Marla" : l.sizeUnit === "SQFT" ? "sq ft" : "sq yd";
  const kind = { HOUSE: "house", PLOT: "plot", FLAT: "flat", COMMERCIAL: "shop" }[l.category];
  return l.sizeValue ? `${l.sizeValue} ${unit} ${kind}` : `New ${kind}`;
}

function qualityOf(l: Listing, u: User): QualityCheck[] {
  const descOk = (l.description ?? "").trim().length >= 40;
  return [
    { key: "basics", label: "Type, size, location", passed: !!(l.category && l.sizeValue && l.localityId), hint: "Add the size and pick the area." },
    { key: "price", label: "Price", passed: Number(l.pricePkr || 0) > 0, hint: "Add your asking price." },
    { key: "description", label: "Description", passed: descOk, hint: "Write at least 40 characters." },
    { key: "photos", label: "5 photos", passed: l.images.length >= 5, hint: `Add ${Math.max(0, 5 - l.images.length)} more photos.` },
    { key: "ownership_doc", label: "Ownership document", passed: l.documents.length > 0, hint: "Upload the registry, transfer or allotment letter." },
    { key: "whatsapp", label: "WhatsApp number", passed: u.phoneVerified, hint: "Verify your WhatsApp number." },
  ];
}
function score(checks: QualityCheck[]) {
  const passed = checks.filter((c) => c.passed).length;
  return Math.round((passed / checks.length) * 100) - (passed === checks.length ? 4 : 0);
}

function activeOrderFor(listingId: string) {
  return db().orders.find((o) => o.listingId === listingId && o.status === "ACTIVE") ?? null;
}

function toCard(l: Listing, u: User): ListingCard {
  const loc = locality(l.localityId);
  const o = activeOrderFor(l.id);
  const plan = o ? PLANS.find((p) => p.id === o.planId)! : null;
  const checks = qualityOf(l, u);
  return {
    id: l.id,
    slug: l.slug,
    title: titleOf(l),
    category: l.category,
    locality: { id: loc?.id ?? "", name: loc?.name ?? "", regionName: regionName(l.regionId) },
    pricePkr: l.pricePkr || "0",
    sizeValue: l.sizeValue,
    sizeUnit: l.sizeUnit,
    status: l.status,
    qualityScore: l.status === "DRAFT" ? null : l.id === "lst_g13" ? 96 : l.id === "lst_dha" ? 91 : l.id === "lst_bahria" ? 88 : l.id === "lst_adiala" ? 41 : score(checks),
    leadCount: db().leads.filter((x) => x.listingId === l.id).length,
    createdAt: l.createdAt,
    activeOrder: o && plan && o.windowEndsAt ? { id: o.id, planName: plan.name, leadCount: o.leadCount, deliveredCount: o.deliveredCount, windowEndsAt: o.windowEndsAt, daysLeft: daysLeft(o.windowEndsAt) } : null,
    coverUrl: l.images[0]?.url || null,
  };
}

function ownListing(u: User, id: string): Listing {
  const l = db().listings.find((x) => x.id === id && x.customerId === u.customerId && x.status !== "ARCHIVED");
  if (!l) throw new MockError(404, "We couldn't find that listing.");
  return l;
}
function ownLead(u: User, id: string): Lead {
  const l = db().leads.find((x) => x.id === id && x.customerId === u.customerId);
  if (!l) throw new MockError(404, "We couldn't find that lead.");
  return l;
}
function ownOrder(u: User, id: string): Order {
  const o = db().orders.find((x) => x.id === id && x.customerId === u.customerId);
  if (!o) throw new MockError(404, "We couldn't find that order.");
  return o;
}

function toLeadItem(l: Lead): LeadListItem {
  const listing = db().listings.find((x) => x.id === l.listingId)!;
  return {
    id: l.id,
    buyerName: l.buyerName,
    initials: initialsOf(l.buyerName),
    phone: l.phone,
    listing: { id: listing.id, title: titleOf(listing), localityName: locality(listing.localityId)?.name ?? "" },
    said: l.said,
    budgetMinPkr: l.budgetMinPkr,
    budgetMaxPkr: l.budgetMaxPkr,
    timeline: l.timeline,
    source: l.source,
    customerStage: l.customerStage,
    status: l.status,
    deliveredAt: l.deliveredAt,
  };
}

function settle(o: Order) {
  // mock payment provider: a pending order with a payment flips to ACTIVE a few seconds later
  if (o.status === "PENDING_PAYMENT" && o.paidAt && Date.now() >= o.paidAt) {
    const current = db().orders.find((x) => x.listingId === o.listingId && x.status === "ACTIVE" && x.id !== o.id);
    const plan = PLANS.find((p) => p.id === o.planId)!;
    const start = current?.windowEndsAt ? new Date(current.windowEndsAt).getTime() : Date.now();
    o.status = "ACTIVE";
    o.windowStartsAt = iso(start);
    o.windowEndsAt = iso(start + plan.deliveryDays * DAY);
    o.payments = o.payments.map((p) => ({ ...p, status: "SUCCEEDED" }));
    db().notifications.unshift({ id: uid("ntf"), customerId: o.customerId, type: "ORDER_STARTED", title: `${plan.name} package started`, body: `${plan.leadCount} leads over 60 days`, href: "/packages", createdAt: iso(Date.now()), readAt: null });
  }
}

function toOrderCard(o: Order): OrderCard {
  settle(o);
  const l = db().listings.find((x) => x.id === o.listingId)!;
  const plan = PLANS.find((p) => p.id === o.planId)!;
  return {
    id: o.id,
    status: o.status,
    planName: plan.name,
    leadCount: o.leadCount,
    deliveredCount: o.deliveredCount,
    pricePkr: o.pricePkr,
    pricePerLeadPkr: o.pricePerLeadPkr,
    windowStartsAt: o.windowStartsAt,
    windowEndsAt: o.windowEndsAt,
    daysLeft: o.windowEndsAt && o.status === "ACTIVE" ? daysLeft(o.windowEndsAt) : null,
    listing: { id: l.id, title: titleOf(l), localityName: locality(l.localityId)?.name ?? "", category: l.category },
    cashback: o.cashback,
  };
}

// ---------------------------------------------------------------- users (auth itself is real)

/** The signed-in person as the real auth module sees them; mirrored here so mock data can hang off it. */
export type RealUser = { id: string; email: string; kind: CustomerKind; displayName: string; contactPerson: string | null; phoneVerified: boolean };

/**
 * Makes sure the mock store knows this real user. The first real account with a demo email
 * (demo@leads.pk = agency, owner@leads.pk = owner) takes over that seeded data; every other account starts empty.
 */
export function syncUser(r: RealUser): void {
  const d = db();
  let u = d.users.find((x) => x.id === r.id);
  if (!u) {
    const demo = d.users.find((x) => (x.id === "usr_demo" || x.id === "usr_owner") && x.email === r.email.toLowerCase());
    if (demo) {
      demo.id = r.id;
      u = demo;
    } else {
      u = { id: r.id, customerId: uid("cus"), email: r.email, kind: r.kind, displayName: r.displayName, contactPerson: r.contactPerson, phoneVerified: r.phoneVerified, deleted: false };
      d.users.push(u);
    }
  }
  Object.assign(u, { email: r.email, kind: r.kind, displayName: r.displayName, contactPerson: r.contactPerson, phoneVerified: r.phoneVerified });
}

export function counts(userId: string): Me["counts"] {
  const u = userById(userId);
  const d = db();
  return {
    newLeads: d.leads.filter((l) => l.customerId === u.customerId && l.customerStage === "NEW" && l.status !== "REPORTED").length,
    unreadNotifications: d.notifications.filter((n) => n.customerId === u.customerId && !n.readAt).length,
    listings: d.listings.filter((l) => l.customerId === u.customerId && l.status !== "ARCHIVED").length,
  };
}

export function hasActivePackage(userId: string): boolean {
  const u = userById(userId);
  return db().orders.some((o) => o.customerId === u.customerId && o.status === "ACTIVE");
}

export function forget(userId: string): void {
  const u = db().users.find((x) => x.id === userId);
  if (u) u.deleted = true;
}

// ---------------------------------------------------------------- profile city (owner)

export function cityOf(userId: string): string | null {
  return userById(userId).city ?? null;
}
export function setCity(userId: string, city: string): string {
  userById(userId).city = city;
  return city;
}

// ---------------------------------------------------------------- dashboard

export function dashboardSummary(userId: string): DashboardSummary {
  const u = userById(userId);
  const now = Date.now();
  const active = db()
    .orders.filter((o) => o.customerId === u.customerId)
    .filter((o) => (settle(o), o.status === "ACTIVE" && o.windowStartsAt && o.windowEndsAt));
  const activeOrders = active.map((o) => {
    const l = db().listings.find((x) => x.id === o.listingId)!;
    const plan = PLANS.find((p) => p.id === o.planId)!;
    const start = new Date(o.windowStartsAt!).getTime();
    const dayOfWindow = Math.min(plan.deliveryDays, Math.max(1, Math.floor((now - start) / DAY) + 1));
    return {
      id: o.id,
      listingId: l.id,
      listingTitle: titleOf(l),
      localityName: locality(l.localityId)?.name ?? "",
      planName: plan.name,
      leadCount: o.leadCount,
      deliveredCount: o.deliveredCount,
      windowStartsAt: o.windowStartsAt!,
      windowEndsAt: o.windowEndsAt!,
      daysLeft: daysLeft(o.windowEndsAt!),
      dayOfWindow,
      expectedByToday: Math.round((o.leadCount * dayOfWindow) / plan.deliveryDays),
    };
  });
  // projected finish: each package at its own rate so far; the latest one wins
  let projected: number | null = null;
  for (const o of activeOrders) {
    if (!o.deliveredCount) continue;
    const start = new Date(o.windowStartsAt).getTime();
    const t = start + ((o.leadCount / o.deliveredCount) * o.dayOfWindow - 1) * DAY;
    projected = Math.max(projected ?? 0, t);
  }

  const mine = db().leads.filter((l) => l.customerId === u.customerId);
  const live = mine.filter((l) => l.status !== "REPORTED");
  const today0 = karachiMidnight(now);
  const at = (l: Lead) => new Date(l.deliveredAt).getTime();
  const monday = today0 - karachiDay(now).dow * DAY;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const days = labels.map((label, i) => {
    const from = monday + i * DAY;
    return { date: iso(from), label, count: mine.filter((l) => at(l) >= from && at(l) < from + DAY).length };
  });
  const waiting = live.filter((l) => l.customerStage === "NEW").sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt));
  const followUpsToday = mine
    .filter((l) => l.followUpAt && new Date(l.followUpAt).getTime() >= today0 && new Date(l.followUpAt).getTime() < today0 + DAY)
    .sort((a, b) => a.followUpAt!.localeCompare(b.followUpAt!))
    .map((l) => ({
      leadId: l.id,
      buyerName: l.buyerName,
      listingTitle: ((x) => `${x.title} · ${x.localityName}`)(toLeadItem(l).listing),
      at: l.followUpAt!,
      // TODO(api): no picker for the kind in the design yet; a viewing-stage lead defaults to a visit
      kind: l.followUpKind ?? (l.customerStage === "VIEWING" ? ("VISIT" as const) : ("CALL" as const)),
    }));

  return {
    activeOrders,
    totals: {
      delivered: activeOrders.reduce((n, o) => n + o.deliveredCount, 0),
      bought: activeOrders.reduce((n, o) => n + o.leadCount, 0),
      expectedByToday: activeOrders.reduce((n, o) => n + o.expectedByToday, 0),
      projectedEndDate: projected === null ? null : iso(projected),
    },
    today: mine.filter((l) => at(l) >= today0).length,
    thisWeek: { days, total: days.reduce((n, d) => n + d.count, 0) },
    pipeline: {
      new: live.filter((l) => l.customerStage === "NEW").length,
      contacted: live.filter((l) => l.customerStage === "CONTACTED").length,
      viewing: live.filter((l) => l.customerStage === "VIEWING").length,
      won: live.filter((l) => l.customerStage === "CLOSED_WON").length,
      lost: live.filter((l) => l.customerStage === "CLOSED_LOST").length,
    },
    reportsUnderCheck: mine.filter((l) => l.status === "REPORTED").length,
    waiting: { count: waiting.length, oldestAt: waiting[0]?.deliveredAt ?? null, items: waiting.slice(0, 3).map(toLeadItem) },
    followUpsToday,
  };
}

// ---------------------------------------------------------------- leads

const FILTER_MATCH: Record<LeadStageFilter, (l: Lead) => boolean> = {
  new: (l) => l.customerStage === "NEW" && l.status !== "REPORTED",
  contacted: (l) => l.customerStage === "CONTACTED" && l.status !== "REPORTED",
  viewing: (l) => l.customerStage === "VIEWING" && l.status !== "REPORTED",
  won: (l) => l.customerStage === "CLOSED_WON" && l.status !== "REPORTED",
  lost: (l) => l.customerStage === "CLOSED_LOST" && l.status !== "REPORTED",
  reported: (l) => l.status === "REPORTED" || l.status === "REPORT_UPHELD",
};

export function listLeads(userId: string, q: { stage?: LeadStageFilter; listing?: string; q?: string; page?: number; pageSize?: number }) {
  const u = userById(userId);
  const mine = db().leads.filter((l) => l.customerId === u.customerId);
  const base = mine.filter((l) => {
    if (q.listing && l.listingId !== q.listing) return false;
    if (q.q) {
      const s = q.q.trim().toLowerCase();
      const digits = s.replace(/\D/g, "");
      if (!l.buyerName.toLowerCase().includes(s) && !(digits.length >= 3 && l.phone.replace(/\D/g, "").includes(digits))) return false;
    }
    return true;
  });
  const counts: LeadCounts = {
    all: base.length,
    new: base.filter(FILTER_MATCH.new).length,
    contacted: base.filter(FILTER_MATCH.contacted).length,
    viewing: base.filter(FILTER_MATCH.viewing).length,
    won: base.filter(FILTER_MATCH.won).length,
    lost: base.filter(FILTER_MATCH.lost).length,
    reported: base.filter(FILTER_MATCH.reported).length,
  };
  const rows = (q.stage ? base.filter(FILTER_MATCH[q.stage]) : base).sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
  const pageSize = Math.min(100, q.pageSize ?? 20);
  const page = Math.max(1, q.page ?? 1);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(toLeadItem), total: rows.length, page, pageSize, counts };
}

export function getLead(userId: string, id: string): LeadDetail {
  const u = userById(userId);
  const l = ownLead(u, id);
  const o = l.orderId ? db().orders.find((x) => x.id === l.orderId) : null;
  const plan = o ? PLANS.find((p) => p.id === o.planId) : null;
  return {
    ...toLeadItem(l),
    note: l.note,
    followUpAt: l.followUpAt,
    followUpKind: l.followUpKind,
    order: o && plan ? { id: o.id, planName: plan.name, deliveredCount: o.deliveredCount, leadCount: o.leadCount } : null,
    conversation: l.conversation,
    activity: [...l.activity].sort((a, b) => b.at.localeCompare(a.at)),
    report: l.report,
    reportableUntil: iso(new Date(l.deliveredAt).getTime() + 7 * DAY),
  };
}

export function patchLead(userId: string, id: string, patch: { customerStage?: CustomerStage; note?: string; followUpAt?: string | null; followUpKind?: FollowUpKind | null }) {
  const u = userById(userId);
  const l = ownLead(u, id);
  if (patch.customerStage && l.status === "REPORTED") throw new MockError(409, "This lead is under check. You can change its status after we reply.");
  if (patch.customerStage && patch.customerStage !== l.customerStage) {
    l.customerStage = patch.customerStage;
    const label = { NEW: "New", CONTACTED: "Contacted", VIEWING: "Viewing", CLOSED_WON: "Won", CLOSED_LOST: "Lost" }[patch.customerStage];
    l.activity.push({ at: iso(Date.now()), text: `You marked this lead ${label}` });
  }
  if (patch.note !== undefined) l.note = patch.note.slice(0, 2000);
  if (patch.followUpAt !== undefined) l.followUpAt = patch.followUpAt;
  if (patch.followUpKind !== undefined) l.followUpKind = patch.followUpKind;
  if (patch.followUpAt === null) l.followUpKind = null;
  return getLead(userId, id);
}

export function reportLead(userId: string, id: string, reason: ReportReason, details?: string) {
  const u = userById(userId);
  const l = ownLead(u, id);
  if (l.report) throw new MockError(409, "You already reported this lead.");
  if (Date.now() > new Date(l.deliveredAt).getTime() + 7 * DAY) throw new MockError(422, "Reporting closed for this lead.");
  l.report = { status: "OPEN", reason, details: details?.slice(0, 500) || null };
  l.status = "REPORTED";
  l.activity.push({ at: iso(Date.now()), text: "You reported this lead. We'll check within 48 hours." });
  return { report: { status: "OPEN" as const } };
}

export function exportLeadsCsv(userId: string, q: Parameters<typeof listLeads>[1]): string {
  const { items } = listLeads(userId, { ...q, page: 1, pageSize: 100_000 });
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = items.map((l) => [l.buyerName, l.phone, l.listing.title + ", " + l.listing.localityName, l.said ?? "", [l.budgetMinPkr, l.budgetMaxPkr].filter(Boolean).join("-"), l.timeline ?? "", l.customerStage, l.deliveredAt].map((v) => esc(String(v))).join(","));
  return ["Name,Phone,Listing,Said,Budget,Timeline,Stage,Received", ...rows].join("\n");
}

// ---------------------------------------------------------------- listings

const LISTING_FILTER: Record<string, ListingStatus> = { live: "APPROVED", review: "UNDER_REVIEW", info: "NEEDS_INFO", rejected: "REJECTED", draft: "DRAFT", paused: "PAUSED", sold: "SOLD" };

export function listMine(userId: string, q: { status?: string; page?: number; pageSize?: number }) {
  const u = userById(userId);
  const mine = db().listings.filter((l) => l.customerId === u.customerId && l.status !== "ARCHIVED");
  const c = (s: ListingStatus) => mine.filter((l) => l.status === s).length;
  const counts: ListingCounts = { all: mine.length, live: c("APPROVED"), review: c("UNDER_REVIEW"), info: c("NEEDS_INFO"), rejected: c("REJECTED"), draft: c("DRAFT"), paused: c("PAUSED"), sold: c("SOLD") };
  const st = q.status ? LISTING_FILTER[q.status] : undefined;
  const rows = (st ? mine.filter((l) => l.status === st) : mine).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pageSize = Math.min(100, q.pageSize ?? 50);
  const page = Math.max(1, q.page ?? 1);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize).map((l) => toCard(l, u)), total: rows.length, counts };
}

export function createListing(userId: string, category: ListingCategory) {
  const u = userById(userId);
  const id = uid("lst");
  const now = iso(Date.now());
  db().listings.push({
    id,
    customerId: u.customerId,
    slug: id,
    category,
    sizeValue: "",
    sizeUnit: "MARLA",
    bedrooms: null,
    bathrooms: null,
    pricePkr: "",
    regionId: "reg_isb",
    localityId: null,
    addressText: null,
    description: "",
    amenities: [],
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    images: [],
    documents: [],
    reviews: [],
    timeline: [],
  });
  return { id };
}

export function getListing(userId: string, id: string): ListingDetail {
  const u = userById(userId);
  const l = ownListing(u, id);
  const checks = qualityOf(l, u);
  const loc = locality(l.localityId);
  const benchmark =
    loc && l.sizeValue && l.category !== "COMMERCIAL"
      ? { minPkr: String(Math.round(Number(l.sizeValue) * (l.sizeUnit === "KANAL" ? 20 : 1) * 2_600_000)), maxPkr: String(Math.round(Number(l.sizeValue) * (l.sizeUnit === "KANAL" ? 20 : 1) * 3_250_000)), sampleSize: 14 }
      : null;
  return {
    ...toCard(l, u),
    description: l.description,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    addressText: l.addressText,
    amenities: l.amenities,
    images: [...l.images].sort((a, b) => a.position - b.position),
    documents: l.documents,
    quality: { checks, passed: checks.filter((c) => c.passed).length, total: checks.length },
    benchmark,
    reviews: l.reviews,
    timeline: l.timeline,
    ownerName: u.kind === "AGENCY" ? l.ownerName ?? null : null,
  };
}

const EDITABLE: ListingStatus[] = ["DRAFT", "NEEDS_INFO", "REJECTED", "APPROVED", "PAUSED"];

export function patchListing(userId: string, id: string, patch: ListingPatch) {
  const u = userById(userId);
  const l = ownListing(u, id);
  if (!EDITABLE.includes(l.status)) throw new MockError(409, l.status === "SOLD" ? "This listing is sold." : "This listing is under review. You can edit it after we reply.");
  if (patch.category) l.category = patch.category;
  if (patch.sizeValue !== undefined) l.sizeValue = patch.sizeValue.replace(/[^\d.]/g, "");
  if (patch.sizeUnit) l.sizeUnit = patch.sizeUnit;
  if (patch.bedrooms !== undefined) l.bedrooms = patch.bedrooms;
  if (patch.bathrooms !== undefined) l.bathrooms = patch.bathrooms;
  if (patch.pricePkr !== undefined) l.pricePkr = patch.pricePkr.replace(/\D/g, "");
  if (patch.regionId) {
    if (patch.regionId !== l.regionId) l.localityId = null;
    l.regionId = patch.regionId;
  }
  if (patch.localityId !== undefined) l.localityId = patch.localityId || null;
  if (patch.addressText !== undefined) l.addressText = patch.addressText;
  if (patch.description !== undefined) l.description = patch.description;
  if (patch.amenities) l.amenities = patch.amenities;
  if (patch.ownerName !== undefined && u.kind === "AGENCY") l.ownerName = patch.ownerName.trim().slice(0, 100) || null;
  l.updatedAt = iso(Date.now());
  return getListing(userId, id);
}

export function submitListing(userId: string, id: string) {
  const u = userById(userId);
  const l = ownListing(u, id);
  const checks = qualityOf(l, u);
  if (checks.some((c) => !c.passed)) throw new MockError(422, "Some checks still fail.", { checks: JSON.stringify(checks) });
  if (!EDITABLE.includes(l.status)) throw new MockError(409, "This listing can't be submitted right now.");
  l.status = "UNDER_REVIEW";
  l.timeline.push({ status: "UNDER_REVIEW", at: iso(Date.now()) });
  db().notifications.unshift({ id: uid("ntf"), customerId: u.customerId, type: "LISTING_IN_REVIEW", title: `${titleOf(l)} is in review`, body: `${locality(l.localityId)?.name ?? ""} · usually done within 24 hours`, href: `/listings/${l.id}`, createdAt: iso(Date.now()), readAt: null });
  return {};
}

export function addImage(userId: string, id: string, url: string) {
  const u = userById(userId);
  const l = ownListing(u, id);
  const image = { id: uid("img"), url, position: l.images.length };
  l.images.push(image);
  return { image };
}
export function deleteImage(userId: string, id: string, imageId: string) {
  const u = userById(userId);
  const l = ownListing(u, id);
  l.images = l.images.filter((i) => i.id !== imageId).map((i, n) => ({ ...i, position: n }));
}
export function reorderImages(userId: string, id: string, ids: string[]) {
  const u = userById(userId);
  const l = ownListing(u, id);
  l.images = ids.map((iid, n) => ({ ...l.images.find((i) => i.id === iid)!, position: n })).filter((i) => i.id);
}
export function addDocument(userId: string, id: string, kind: DocumentKind, fileName: string) {
  const u = userById(userId);
  const l = ownListing(u, id);
  const document = { id: uid("doc"), kind, fileName, uploadedAt: iso(Date.now()) };
  l.documents = [document];
  return { document };
}

export function setListingStatus(userId: string, id: string, action: "pause" | "resume" | "mark-sold") {
  const u = userById(userId);
  const l = ownListing(u, id);
  if (action === "pause") {
    if (l.status !== "APPROVED") throw new MockError(409, "Only live listings can be paused.");
    l.status = "PAUSED";
  } else if (action === "resume") {
    if (l.status !== "PAUSED") throw new MockError(409, "Only paused listings can be resumed.");
    l.status = "APPROVED";
  } else {
    if (!["APPROVED", "PAUSED"].includes(l.status)) throw new MockError(409, "Only live or paused listings can be marked sold.");
    l.status = "SOLD";
    const o = activeOrderFor(l.id);
    if (o) {
      const missing = o.leadCount - o.deliveredCount;
      o.status = missing > 0 ? "EXPIRED" : "COMPLETED";
      o.windowEndsAt = iso(Date.now());
      if (missing > 0) o.cashback = { status: "PENDING", undeliveredCount: missing, amountPkr: String(missing * Number(o.pricePerLeadPkr)), paidAt: null };
    }
  }
  l.timeline.push({ status: l.status, at: iso(Date.now()) });
  return {};
}

export function localities(region: string, q?: string) {
  const r = REGIONS.find((x) => x.slug === region);
  const s = (q ?? "").trim().toLowerCase();
  return { items: LOCALITIES.filter((l) => (!r || l.regionId === r.id) && (!s || l.name.toLowerCase().includes(s))).slice(0, 20).map(({ regionId: _r, ...l }) => (void _r, l)) };
}

export function localityBySlug(city: string, area: string) {
  const r = REGIONS.find((x) => x.slug === city);
  if (!r) return null;
  const l = LOCALITIES.find((x) => x.regionId === r.id && x.slug === area);
  return l ? { region: r.name, name: l.name, slug: l.slug } : null;
}

export function allAreaSlugs() {
  return LOCALITIES.filter((l) => !l.name.includes("/")).map((l) => ({ city: REGIONS.find((r) => r.id === l.regionId)!.slug, area: l.slug }));
}

// ---------------------------------------------------------------- orders

export function packagePlans() {
  return { items: PLANS };
}

export function listOrders(userId: string, scope: "active" | "past") {
  const u = userById(userId);
  const all = db().orders.filter((o) => o.customerId === u.customerId).map(toOrderCard);
  const active = all.filter((o) => o.status === "ACTIVE");
  const items = scope === "active" ? active : all.filter((o) => ["COMPLETED", "EXPIRED", "CANCELLED"].includes(o.status));
  return {
    items: items.sort((a, b) => (scope === "active" ? 1 : -1) * (a.windowStartsAt ?? "").localeCompare(b.windowStartsAt ?? "")),
    totals: {
      activeOrders: active.length,
      delivered: active.reduce((s, o) => s + o.deliveredCount, 0),
      bought: active.reduce((s, o) => s + o.leadCount, 0),
      cashbackPaidLeads: all.reduce((s, o) => s + (o.cashback?.status === "PAID" ? o.cashback.undeliveredCount : 0), 0),
    },
  };
}

export function createOrder(userId: string, listingId: string, planId: string) {
  const u = userById(userId);
  const l = ownListing(u, listingId);
  if (l.status !== "APPROVED") throw new MockError(409, "Only live listings can get a package.");
  const pending = db().orders.find((o) => o.listingId === l.id && o.status === "PENDING_PAYMENT");
  if (pending) throw new MockError(409, "This listing already has an order waiting for payment.", { orderId: pending.id });
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new MockError(422, "Pick a package.", { packagePlanId: "Pick a package." });
  const o: Order = {
    id: uid("ord"),
    customerId: u.customerId,
    listingId: l.id,
    planId: plan.id,
    status: "PENDING_PAYMENT",
    leadCount: plan.leadCount,
    deliveredCount: 0,
    pricePkr: plan.pricePkr,
    pricePerLeadPkr: plan.pricePerLeadPkr,
    windowStartsAt: null,
    windowEndsAt: null,
    createdAt: iso(Date.now()),
    cashback: null,
    payments: [],
    paidAt: null,
  };
  db().orders.push(o);
  return { orderId: o.id };
}

export function getOrder(userId: string, id: string): OrderDetail {
  const u = userById(userId);
  const o = ownOrder(u, id);
  const card = toOrderCard(o);
  const current = db().orders.find((x) => x.listingId === o.listingId && x.status === "ACTIVE" && x.id !== o.id);
  return { ...card, payments: o.payments, startsAt: o.windowStartsAt ?? current?.windowEndsAt ?? iso(Date.now()) };
}

export function payOrder(userId: string, id: string, method: PaymentMethod): PayResult {
  const u = userById(userId);
  const o = ownOrder(u, id);
  if (o.status !== "PENDING_PAYMENT") throw new MockError(409, "This order isn't waiting for payment.");
  o.payments.push({ status: "PENDING", provider: method, createdAt: iso(Date.now()) });
  if (method === "BANK_TRANSFER") {
    return { instructions: { bank: "Meezan Bank", accountTitle: "LEADS Pvt Ltd", iban: "PK36MEZN0001234567890123", reference: `LD-${o.id.slice(-6).toUpperCase()}` } };
  }
  // the fake provider "charges" right away and confirms a few seconds later
  o.paidAt = Date.now() + 4000;
  return { redirectUrl: `/checkout/${o.id}/return` };
}

// ---------------------------------------------------------------- notifications

const TYPE_GROUP: Record<string, NotificationType[]> = {
  lead: ["LEAD_DELIVERED", "REPORT_DECIDED"],
  listing: ["LISTING_IN_REVIEW", "LISTING_APPROVED", "LISTING_NEEDS_INFO", "LISTING_REJECTED"],
  package: ["ORDER_STARTED", "ORDER_ENDING", "ORDER_ENDED", "CASHBACK_PAID"],
};

export function listNotifications(userId: string, q: { type?: string; cursor?: string }) {
  const u = userById(userId);
  const mine = db().notifications.filter((n) => n.customerId === u.customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = q.type && TYPE_GROUP[q.type] ? mine.filter((n) => TYPE_GROUP[q.type!].includes(n.type)) : mine;
  const start = q.cursor ? rows.findIndex((n) => n.id === q.cursor) + 1 : 0;
  const page = rows.slice(start, start + 20);
  return {
    items: page.map(({ customerId: _c, ...n }) => (void _c, n)),
    nextCursor: start + 20 < rows.length ? page[page.length - 1]?.id ?? null : null,
    unread: mine.filter((n) => !n.readAt).length,
  };
}

export function readAllNotifications(userId: string) {
  const u = userById(userId);
  db().notifications.forEach((n) => {
    if (n.customerId === u.customerId && !n.readAt) n.readAt = iso(Date.now());
  });
}

export function readNotification(userId: string, id: string) {
  const u = userById(userId);
  const n = db().notifications.find((x) => x.id === id && x.customerId === u.customerId);
  if (!n) throw new MockError(404, "Not found.");
  n.readAt = n.readAt ?? iso(Date.now());
}
