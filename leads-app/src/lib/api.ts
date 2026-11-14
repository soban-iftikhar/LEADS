// Typed calls for every endpoint in the UI <-> backend contract.
// Each call currently goes to the mock store (src/mocks) through a server action; swap the body for
// apiFetch() once the endpoint exists. Callers never change: same name, same shape.
import * as M from "@/mocks/actions";
import type { MockResult } from "@/mocks/actions";
import type {
  CustomerKind,
  CustomerStage,
  DashboardSummary,
  DocumentKind,
  LeadCounts,
  LeadDetail,
  LeadListItem,
  LeadStageFilter,
  ListingCard,
  ListingCategory,
  ListingCounts,
  ListingDetail,
  ListingPatch,
  Locality,
  Me,
  NotificationItem,
  NotificationSettings,
  OrderCard,
  OrderDetail,
  PackagePlan,
  Paged,
  PaymentMethod,
  PayResult,
  ReportReason,
} from "@/types/api";

/** Error with the contract's status, human message and per-field errors. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string> | null = null,
  ) {
    super(message);
  }
}

async function unwrap<T>(p: Promise<MockResult<T>>): Promise<T> {
  const r = await p;
  if (r.ok) return r.data;
  throw new ApiError(r.status, r.message, r.errors);
}

/** For real endpoints: same-origin fetch that unwraps { success, data }. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, credentials: "same-origin" });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { success: boolean; data?: T; message?: string; errors?: Record<string, string> | null } | null;
  if (!res.ok || !body?.success) throw new ApiError(res.status, body?.message ?? "Something went wrong. Please try again.", body?.errors ?? null);
  return body.data as T;
}

// ---------------------------------------------------------------- auth

// TODO(api): POST /api/auth/login
export const login = (email: string, password: string, remember: boolean): Promise<Me> => unwrap(M.mLogin(email, password, remember));
// TODO(api): POST /api/auth/register
export const register = (body: { kind: CustomerKind; displayName: string; contactPerson?: string; email: string; phone: string; password: string; acceptTerms: true }): Promise<{ userId: string; phoneMasked: string }> =>
  unwrap(M.mRegister(body));
// TODO(api): POST /api/auth/verify-phone
export const verifyPhone = (otp: string): Promise<{ phoneVerified: true }> => unwrap(M.mVerifyPhone(otp)) as Promise<{ phoneVerified: true }>;
// TODO(api): POST /api/auth/resend-otp
export const resendOtp = (): Promise<{ retryAfterSec: number }> => unwrap(M.mResendOtp());
// TODO(api): POST /api/auth/logout
export const logout = (): Promise<void> => unwrap(M.mLogout());
// TODO(api): POST /api/auth/forgot-password
export const forgotPassword = (email: string): Promise<unknown> => unwrap(M.mForgot(email));
// TODO(api): POST /api/auth/reset-password
export const resetPassword = (token: string, password: string): Promise<unknown> => unwrap(M.mReset(token, password));
// TODO(api): POST /api/auth/verify-email
export const verifyEmail = (token: string): Promise<{ emailVerified: boolean }> => unwrap(M.mVerifyEmail(token));
// TODO(api): GET /api/me
export const getMe = (): Promise<Me> => unwrap(M.mMe());
/** Full number for the verify screen ("+92 300 1234567"). TODO(api): comes from the register response / GET /api/me. */
export const getOtpPhone = (): Promise<string> => unwrap(M.mPhone());
// TODO(api): PATCH /api/me
export const updateMe = (patch: { displayName?: string; contactPerson?: string; email?: string; phone?: string }): Promise<Me> => unwrap(M.mUpdateMe(patch));
// TODO(api): PATCH /api/me/password
export const changePassword = (currentPassword: string, newPassword: string): Promise<void> => unwrap(M.mChangePassword(currentPassword, newPassword));
// TODO(api): GET /api/me/notification-settings
export const getNotificationSettings = (): Promise<NotificationSettings> => unwrap(M.mGetPrefs());
// TODO(api): PATCH /api/me/notification-settings
export const setNotificationSettings = (patch: Partial<NotificationSettings>): Promise<NotificationSettings> => unwrap(M.mSetPrefs(patch));
// TODO(api): DELETE /api/me
export const deleteAccount = (password: string): Promise<void> => unwrap(M.mDeleteMe(password));

// ---------------------------------------------------------------- dashboard

// TODO(api): GET /api/dashboard/summary
export const getDashboardSummary = (): Promise<DashboardSummary> => unwrap(M.mSummary());

// ---------------------------------------------------------------- leads

export type LeadQuery = { stage?: LeadStageFilter; listing?: string; q?: string; page?: number; pageSize?: number };
// TODO(api): GET /api/leads
export const getLeads = (q: LeadQuery): Promise<Paged<LeadListItem> & { counts: LeadCounts }> => unwrap(M.mLeads(q));
// TODO(api): GET /api/leads/[id]
export const getLead = (id: string): Promise<LeadDetail> => unwrap(M.mLead(id));
// TODO(api): PATCH /api/leads/[id]
export const patchLead = (id: string, patch: { customerStage?: CustomerStage; note?: string; followUpAt?: string | null }): Promise<LeadDetail> => unwrap(M.mPatchLead(id, patch));
// TODO(api): POST /api/leads/[id]/report
export const reportLead = (id: string, reason: ReportReason, details?: string): Promise<{ report: { status: "OPEN" } }> => unwrap(M.mReportLead(id, reason, details));
/** Download link, not a fetch. TODO(api): GET /api/leads/export.csv (mocked by the route handler of the same path). */
export function leadsExportHref(q: LeadQuery): string {
  const p = new URLSearchParams();
  if (q.stage) p.set("stage", q.stage);
  if (q.listing) p.set("listing", q.listing);
  if (q.q) p.set("q", q.q);
  const s = p.toString();
  return `/api/leads/export.csv${s ? `?${s}` : ""}`;
}

// ---------------------------------------------------------------- listings

// TODO(api): GET /api/listings/mine
export const getMyListings = (q: { status?: string; page?: number; pageSize?: number } = {}): Promise<{ items: ListingCard[]; total: number; counts: ListingCounts }> => unwrap(M.mListings(q));
// TODO(api): POST /api/listings
export const createListing = (category: ListingCategory): Promise<{ id: string }> => unwrap(M.mCreateListing(category));
// TODO(api): GET /api/listings/[id]
export const getListing = (id: string): Promise<ListingDetail> => unwrap(M.mListing(id));
// TODO(api): PATCH /api/listings/[id]
export const patchListing = (id: string, patch: ListingPatch): Promise<ListingDetail> => unwrap(M.mPatchListing(id, patch));
// TODO(api): POST /api/listings/[id]/submit
export const submitListing = (id: string): Promise<unknown> => unwrap(M.mSubmitListing(id));
// TODO(api): POST /api/listings/[id]/images (multipart `file`, Cloudinary). The mock keeps a local preview URL.
export const uploadListingImage = (id: string, previewUrl: string): Promise<{ image: { id: string; url: string; position: number } }> => unwrap(M.mAddImage(id, previewUrl));
// TODO(api): DELETE /api/listings/[id]/images/[imageId]
export const deleteListingImage = (id: string, imageId: string): Promise<void> => unwrap(M.mDeleteImage(id, imageId));
// TODO(api): PATCH /api/listings/[id]/images/order
export const reorderListingImages = (id: string, ids: string[]): Promise<void> => unwrap(M.mReorderImages(id, ids));
// TODO(api): POST /api/listings/[id]/documents (multipart `file` + `kind`)
export const uploadListingDocument = (id: string, kind: DocumentKind, fileName: string): Promise<{ document: { id: string; kind: DocumentKind; fileName: string; uploadedAt: string } }> =>
  unwrap(M.mAddDocument(id, kind, fileName));
// TODO(api): POST /api/listings/[id]/pause | /resume | /mark-sold
export const listingAction = (id: string, action: "pause" | "resume" | "mark-sold"): Promise<unknown> => unwrap(M.mListingAction(id, action));
// TODO(api): GET /api/localities
export const getLocalities = (region: "islamabad" | "rawalpindi", q?: string): Promise<{ items: Locality[] }> => unwrap(M.mLocalities(region, q));

// ---------------------------------------------------------------- orders

// TODO(api): GET /api/package-plans
export const getPackagePlans = (): Promise<{ items: PackagePlan[] }> => unwrap(M.mPlans());
// TODO(api): GET /api/orders
export const getOrders = (scope: "active" | "past"): Promise<{ items: OrderCard[]; totals: { activeOrders: number; delivered: number; bought: number; cashbackPaidLeads: number } }> => unwrap(M.mOrders(scope));
// TODO(api): POST /api/orders
export const createOrder = (listingId: string, packagePlanId: string): Promise<{ orderId: string }> => unwrap(M.mCreateOrder(listingId, packagePlanId));
// TODO(api): GET /api/orders/[id]
export const getOrder = (id: string): Promise<OrderDetail> => unwrap(M.mOrder(id));
// TODO(api): POST /api/orders/[id]/pay
export const payOrder = (id: string, method: PaymentMethod): Promise<PayResult> => unwrap(M.mPay(id, method));

// ---------------------------------------------------------------- notifications

// TODO(api): GET /api/notifications
export const getNotifications = (q: { type?: string; cursor?: string }): Promise<{ items: NotificationItem[]; nextCursor: string | null; unread: number }> => unwrap(M.mNotifications(q));
// TODO(api): POST /api/notifications/read-all
export const readAllNotifications = (): Promise<void> => unwrap(M.mReadAll());
// TODO(api): PATCH /api/notifications/[id]
export const readNotification = (id: string): Promise<void> => unwrap(M.mReadOne(id));
