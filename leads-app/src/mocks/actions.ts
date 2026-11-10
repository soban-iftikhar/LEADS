"use server";

// Mock transport: server actions that front the in-memory store, so client mutations and
// server-rendered pages see the same data. TODO(api): remove when the contract endpoints exist.
import { unstable_rethrow } from "next/navigation";
import { currentSession } from "@/server/auth/sessions";
import { AppError } from "@/server/http/errors";
import { pendingPhone, prefsOf, toMe, userWithProfile } from "@/server/modules/auth/service";
import type {
  FollowUpKind,
  CustomerStage,
  DocumentKind,
  LeadStageFilter,
  ListingCategory,
  ListingPatch,
  PaymentMethod,
  ReportReason,
} from "@/types/api";
import * as S from "./store";

export type MockResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; errors: Record<string, string> | null };

async function run<T>(fn: () => T | Promise<T>): Promise<MockResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e); // let Next's own control-flow errors (dynamic usage, redirect, notFound) through
    if (e instanceof S.MockError || e instanceof AppError) return { ok: false, status: e.status, message: e.message, errors: e.errors };
    console.error(e);
    return { ok: false, status: 500, message: "Something went wrong. Please try again.", errors: null };
  }
}

/** The real signed-in customer, mirrored into the mock store. */
async function uidOrThrow(): Promise<string> {
  const s = await currentSession();
  if (!s) throw new S.MockError(401, "Please log in.");
  const u = s.user;
  if (!u.customer) throw new S.MockError(403, "This account can't use the customer app.");
  S.syncUser({ id: u.id, email: u.email, kind: u.customer.kind, displayName: u.customer.displayName, contactPerson: u.customer.contactPerson, phoneVerified: !!u.phoneVerifiedAt });
  return u.id;
}

// identity (real) + counts (mocked modules)
export const mMe = async () =>
  run(async () => {
    const id = await uidOrThrow();
    const u = await userWithProfile(id);
    if (!u) throw new S.MockError(401, "Please log in.");
    return toMe(u, S.counts(id));
  });
export const mGetPrefs = async () =>
  run(async () => {
    const u = await userWithProfile(await uidOrThrow());
    if (!u) throw new S.MockError(401, "Please log in.");
    return prefsOf(u);
  });
/** Number waiting for its WhatsApp code, for the code screen. */
export const mPendingPhone = async () =>
  run(async () => {
    const s = await currentSession();
    if (!s) throw new S.MockError(401, "Please log in.");
    return pendingPhone(s.user);
  });

// dashboard
export const mSummary = async () => run(async () => S.dashboardSummary(await uidOrThrow()));

// leads
export const mLeads = async (q: { stage?: LeadStageFilter; listing?: string; q?: string; page?: number; pageSize?: number }) => run(async () => S.listLeads(await uidOrThrow(), q));
export const mLead = async (id: string) => run(async () => S.getLead(await uidOrThrow(), id));
export const mPatchLead = async (id: string, patch: { customerStage?: CustomerStage; note?: string; followUpAt?: string | null; followUpKind?: FollowUpKind | null }) => run(async () => S.patchLead(await uidOrThrow(), id, patch));
export const mReportLead = async (id: string, reason: ReportReason, details?: string) => run(async () => S.reportLead(await uidOrThrow(), id, reason, details));

// listings
export const mListings = async (q: { status?: string; page?: number; pageSize?: number }) => run(async () => S.listMine(await uidOrThrow(), q));
export const mCreateListing = async (category: ListingCategory) => run(async () => S.createListing(await uidOrThrow(), category));
export const mListing = async (id: string) => run(async () => S.getListing(await uidOrThrow(), id));
export const mPatchListing = async (id: string, patch: ListingPatch) => run(async () => S.patchListing(await uidOrThrow(), id, patch));
export const mSubmitListing = async (id: string) => run(async () => S.submitListing(await uidOrThrow(), id));
export const mAddImage = async (id: string, url: string) => run(async () => S.addImage(await uidOrThrow(), id, url));
export const mDeleteImage = async (id: string, imageId: string) => run(async () => S.deleteImage(await uidOrThrow(), id, imageId));
export const mReorderImages = async (id: string, ids: string[]) => run(async () => S.reorderImages(await uidOrThrow(), id, ids));
export const mAddDocument = async (id: string, kind: DocumentKind, fileName: string) => run(async () => S.addDocument(await uidOrThrow(), id, kind, fileName));
export const mListingAction = async (id: string, action: "pause" | "resume" | "mark-sold") => run(async () => S.setListingStatus(await uidOrThrow(), id, action));
export const mLocalities = async (region: string, q?: string) => run(() => S.localities(region, q));

// orders
export const mPlans = async () => run(() => S.packagePlans());
export const mOrders = async (scope: "active" | "past") => run(async () => S.listOrders(await uidOrThrow(), scope));
export const mCreateOrder = async (listingId: string, packagePlanId: string) => run(async () => S.createOrder(await uidOrThrow(), listingId, packagePlanId));
export const mOrder = async (id: string) => run(async () => S.getOrder(await uidOrThrow(), id));
export const mPay = async (id: string, method: PaymentMethod) => run(async () => S.payOrder(await uidOrThrow(), id, method));

// notifications
export const mNotifications = async (q: { type?: string; cursor?: string }) => run(async () => S.listNotifications(await uidOrThrow(), q));
export const mReadAll = async () => run(async () => S.readAllNotifications(await uidOrThrow()));
export const mReadOne = async (id: string) => run(async () => S.readNotification(await uidOrThrow(), id));
