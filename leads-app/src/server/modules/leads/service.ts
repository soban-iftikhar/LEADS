import "server-only";
import type { CustomerStage, LeadStatus as DbLeadStatus, Prisma } from "@prisma/client";
import { normalizePhone, phoneHashOf, revealPhone } from "@/server/crypto/phone";
import { prisma } from "@/server/db";
import { AppError, conflict, notFound } from "@/server/http/errors";
import { setting } from "@/server/modules/settings/service";
import { firstName, toE164 } from "@/lib/format";
import { CUSTOMER_STAGE } from "@/lib/labels";
import type { LeadCounts, LeadDetail, LeadListItem, LeadStageFilter, LeadStatus, ReportReason } from "@/types/api";
import type { LeadPatch, LeadsQuery } from "./schema";

/**
 * Delivered leads (DR-10). Leads are written by the Python delivery agent; customers read them,
 * move them through their own pipeline and may report a bad one. Every query is scoped by the
 * customer's id: one customer never sees another's leads.
 */

const DAY = 86_400_000;
const FORM_SAID = "Filled in the property form";
const EXPORT_LIMIT = 10_000;

const listInclude = {
  contact: { select: { name: true, phoneEnc: true } },
  listing: { select: { id: true, title: true, locality: { select: { name: true } } } },
} satisfies Prisma.LeadInclude;
type ListRow = Prisma.LeadGetPayload<{ include: typeof listInclude }>;

const API_STATUS: Record<DbLeadStatus, LeadStatus> = { DELIVERED: "ACTIVE", REPORTED: "REPORTED", REPORT_UPHELD: "REPORT_UPHELD", REPORT_REJECTED: "REPORT_REJECTED" };

const notReported = { status: { not: "REPORTED" } } satisfies Prisma.LeadWhereInput;
const STAGE_WHERE: Record<LeadStageFilter, Prisma.LeadWhereInput> = {
  new: { customerStage: "NEW", ...notReported },
  contacted: { customerStage: "CONTACTED", ...notReported },
  viewing: { customerStage: "VIEWING", ...notReported },
  won: { customerStage: "CLOSED_WON", ...notReported },
  lost: { customerStage: "CLOSED_LOST", ...notReported },
  reported: { status: { in: ["REPORTED", "REPORT_UPHELD"] } },
};

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\s-]/gu, " ").trim().split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
}

/** First reply of the buyer about this listing, per lead id. */
async function firstReplies(leads: { id: string; contactId: string; listingId: string }[]): Promise<Map<string, string>> {
  if (!leads.length) return new Map();
  const rows = await prisma.message.findMany({
    where: { direction: "IN", OR: leads.map((l) => ({ contactId: l.contactId, campaignTarget: { campaign: { listingId: l.listingId } } })) },
    orderBy: { createdAt: "asc" },
    select: { contactId: true, body: true, campaignTarget: { select: { campaign: { select: { listingId: true } } } } },
  });
  const byPair = new Map<string, string>();
  for (const m of rows) {
    const key = `${m.contactId}:${m.campaignTarget?.campaign.listingId}`;
    if (!byPair.has(key)) byPair.set(key, m.body);
  }
  return new Map(leads.flatMap((l) => (byPair.has(`${l.contactId}:${l.listingId}`) ? [[l.id, byPair.get(`${l.contactId}:${l.listingId}`) as string]] : [])));
}

function toItem(l: ListRow, said: string | undefined): LeadListItem {
  const name = l.buyerName ?? l.contact.name ?? "Buyer";
  const phone = revealPhone(l.contact.phoneEnc);
  return {
    id: l.id,
    buyerName: name,
    initials: initialsOf(name),
    phone: phone ? toE164(phone) : "",
    listing: { id: l.listing.id, title: l.listing.title, localityName: l.listing.locality?.name ?? "" },
    said: said ?? (l.source === "CAMPAIGN_FORM" ? FORM_SAID : null),
    budgetMinPkr: l.budgetMinPkr?.toString() ?? null,
    budgetMaxPkr: l.budgetMaxPkr?.toString() ?? null,
    timeline: l.timeline,
    source: l.source,
    customerStage: l.customerStage,
    status: API_STATUS[l.status],
    deliveredAt: l.deliveredAt.toISOString(),
  };
}

async function toItems(rows: ListRow[]): Promise<LeadListItem[]> {
  const said = await firstReplies(rows);
  return rows.map((l) => toItem(l, said.get(l.id)));
}

/**
 * Search by buyer name, or by a full mobile number. Numbers are stored encrypted, so a number
 * is matched through its hash: partial numbers can't be searched.
 */
function searchWhere(q: string | undefined): Prisma.LeadWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const phone = normalizePhone(term);
  if (phone) return { contact: { phoneHash: phoneHashOf(phone) } };
  return { OR: [{ buyerName: { contains: term, mode: "insensitive" } }, { buyerName: null, contact: { name: { contains: term, mode: "insensitive" } } }] };
}

export async function listLeads(customerId: string, q: Omit<LeadsQuery, "page" | "pageSize"> & { page?: number; pageSize?: number }) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const base: Prisma.LeadWhereInput = { customerId, ...(q.listing ? { listingId: q.listing } : {}), ...searchWhere(q.q) };
  const where: Prisma.LeadWhereInput = q.stage ? { AND: [base, STAGE_WHERE[q.stage]] } : base;
  const [rows, total, grouped] = await Promise.all([
    prisma.lead.findMany({ where, include: listInclude, orderBy: [{ deliveredAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["customerStage", "status"], where: base, _count: { _all: true } }),
  ]);
  const sum = (fn: (g: { customerStage: CustomerStage; status: DbLeadStatus }) => boolean) => grouped.filter(fn).reduce((n, g) => n + g._count._all, 0);
  const live = (stage: CustomerStage) => sum((g) => g.customerStage === stage && g.status !== "REPORTED");
  const counts: LeadCounts = {
    all: sum(() => true),
    new: live("NEW"),
    contacted: live("CONTACTED"),
    viewing: live("VIEWING"),
    won: live("CLOSED_WON"),
    lost: live("CLOSED_LOST"),
    reported: sum((g) => g.status === "REPORTED" || g.status === "REPORT_UPHELD"),
  };
  return { items: await toItems(rows), total, page, pageSize, counts };
}

/** New leads (stage NEW, not under report), for the badge in the rail. */
export const countNewLeads = (customerId: string) => prisma.lead.count({ where: { customerId, ...STAGE_WHERE.new } });

/** Leads in the shape the overview uses (waiting list, follow-ups). */
export async function leadItems(where: Prisma.LeadWhereInput, orderBy: Prisma.LeadOrderByWithRelationInput, take?: number): Promise<LeadListItem[]> {
  return toItems(await prisma.lead.findMany({ where, include: listInclude, orderBy, take }));
}

export async function getLead(customerId: string, id: string): Promise<LeadDetail> {
  const l = await prisma.lead.findFirst({
    where: { id, customerId },
    include: { ...listInclude, order: { include: { packagePlan: { select: { name: true } } } }, report: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!l) throw notFound("We couldn't find that lead.");
  const [messages, windowDays] = await Promise.all([
    prisma.message.findMany({
      where: { contactId: l.contactId, campaignTarget: { campaign: { listingId: l.listingId } }, status: { not: "PENDING_STAFF" } },
      orderBy: { createdAt: "asc" },
      select: { direction: true, body: true, createdAt: true, sentAt: true },
    }),
    setting("leads.report_window_days"),
  ]);
  const item = toItem(l, messages.find((m) => m.direction === "IN")?.body);
  const conversation = messages.map((m) => ({ direction: m.direction, body: m.body, at: (m.sentAt ?? m.createdAt).toISOString() }));
  return {
    ...item,
    note: l.note,
    followUpAt: l.followUpAt?.toISOString() ?? null,
    followUpKind: l.followUpKind,
    order: l.order ? { id: l.order.id, planName: l.order.packagePlan.name, deliveredCount: l.order.deliveredCount, leadCount: l.order.leadCount } : null,
    conversation,
    activity: activityOf(l, item.buyerName, conversation),
    report: l.report ? { status: l.report.status, reason: l.report.reason as ReportReason, details: l.report.details } : null,
    reportableUntil: new Date(l.deliveredAt.getTime() + windowDays * DAY).toISOString(),
  };
}

type ActivityLead = Prisma.LeadGetPayload<{ include: { order: { include: { packagePlan: { select: { name: true } } } }; events: true } }>;

/** Newest first. Built from the lead, its messages and its events, so nothing is stored twice. */
function activityOf(l: ActivityLead, buyerName: string, conversation: { direction: "IN" | "OUT"; at: string }[]): { at: string; text: string }[] {
  const first = firstName(buyerName);
  const out: { at: string; text: string }[] = [];
  const sent = conversation.find((m) => m.direction === "OUT");
  const replied = conversation.find((m) => m.direction === "IN");
  if (sent) out.push({ at: sent.at, text: `We sent ${first} your listing on WhatsApp` });
  if (replied) out.push({ at: replied.at, text: `${first} replied “interested”` });
  else if (l.source === "CAMPAIGN_FORM") out.push({ at: l.deliveredAt.toISOString(), text: `${first} filled in the property form` });
  out.push({
    at: l.deliveredAt.toISOString(),
    text: l.order && l.countsTowardOrder ? `Lead delivered to you · counts toward ${l.order.packagePlan.name} package` : "Lead delivered to you",
  });
  for (const e of l.events) {
    const data = (e.data ?? {}) as { to?: CustomerStage; upheld?: boolean };
    const text =
      e.kind === "STAGE_CHANGED" ? `You marked this lead ${data.to ? CUSTOMER_STAGE[data.to].label : "updated"}` :
      e.kind === "REPORTED" ? "You reported this lead. We'll check within 48 hours." :
      data.upheld ? "We accepted your report. This lead doesn't count toward your package." : "We checked your report: the lead is genuine.";
    out.push({ at: e.createdAt.toISOString(), text });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export async function updateLead(customerId: string, id: string, patch: LeadPatch): Promise<LeadDetail> {
  await prisma.$transaction(async (tx) => {
    const l = await tx.lead.findFirst({ where: { id, customerId } });
    if (!l) throw notFound("We couldn't find that lead.");
    const data: Prisma.LeadUpdateInput = {};
    if (patch.customerStage && patch.customerStage !== l.customerStage) {
      if (l.status === "REPORTED") throw conflict("This lead is under check. You can change its status after we reply.");
      data.customerStage = patch.customerStage;
      await tx.leadEvent.create({ data: { leadId: l.id, kind: "STAGE_CHANGED", data: { from: l.customerStage, to: patch.customerStage } } });
    }
    if (patch.note !== undefined) data.note = patch.note.trim() || null;
    if (patch.followUpAt !== undefined) {
      data.followUpAt = patch.followUpAt ? new Date(patch.followUpAt) : null;
      if (patch.followUpAt === null) data.followUpKind = null;
    }
    if (patch.followUpKind !== undefined && patch.followUpAt !== null) data.followUpKind = patch.followUpKind;
    if (Object.keys(data).length) await tx.lead.update({ where: { id: l.id }, data });
  });
  return getLead(customerId, id);
}

export async function reportLead(customerId: string, id: string, reason: ReportReason, details?: string) {
  const windowDays = await setting("leads.report_window_days");
  await prisma.$transaction(async (tx) => {
    const l = await tx.lead.findFirst({ where: { id, customerId }, include: { report: { select: { id: true } } } });
    if (!l) throw notFound("We couldn't find that lead.");
    if (l.report) throw conflict("You already reported this lead.");
    if (Date.now() > l.deliveredAt.getTime() + windowDays * DAY) throw new AppError(422, "Reporting closed for this lead.");
    await tx.leadReport.create({ data: { leadId: l.id, reason, details: details || null } });
    await tx.lead.update({ where: { id: l.id }, data: { status: "REPORTED" } });
    await tx.leadEvent.create({ data: { leadId: l.id, kind: "REPORTED", data: { reason } } });
  });
  return { report: { status: "OPEN" as const } };
}

/** CSV of the filtered leads. Cells that a spreadsheet would run as a formula are neutralised. */
export async function exportLeadsCsv(customerId: string, q: Omit<LeadsQuery, "page" | "pageSize">): Promise<string> {
  const { items } = await listLeads(customerId, { ...q, page: 1, pageSize: EXPORT_LIMIT });
  const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const rows = items.map((l) =>
    [l.buyerName, l.phone, `${l.listing.title}, ${l.listing.localityName}`, l.said ?? "", [l.budgetMinPkr, l.budgetMaxPkr].filter(Boolean).join("-"), l.timeline ?? "", CUSTOMER_STAGE[l.customerStage].label, l.deliveredAt].map(cell).join(","),
  );
  return ["Name,Phone,Listing,Said,Budget,Timeline,Stage,Received", ...rows].join("\r\n");
}
