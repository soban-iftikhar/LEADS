// Browser client for the LEADS API. Server components never use this: they call the services in
// src/server directly. Auth lives in httpOnly cookies only, so there is no token to attach here;
// when the short-lived access token has expired, the first 401 refreshes it once and retries.
import type {
  CustomerKind,
  CustomerStage,
  DocumentKind,
  FollowUpKind,
  LeadDetail,
  ListingCategory,
  ListingDetail,
  ListingPatch,
  ListingStatus,
  Locality,
  Me,
  NotificationItem,
  NotificationSettings,
  OrderDetail,
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
    this.name = "ApiError";
  }
}

type Envelope<T> = { success: boolean; data?: T; message?: string; errors?: Record<string, string> | null };

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, however many calls failed together. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (res.status === 401 && !retried && !path.startsWith("/api/auth/")) {
    if (await refreshOnce()) return request<T>(path, init, true);
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !body?.success) throw new ApiError(res.status, body?.message ?? "Something went wrong. Please try again.", body?.errors ?? null);
  return body.data as T;
}

const json = (method: string, data?: unknown): RequestInit => ({ method, body: data === undefined ? undefined : JSON.stringify(data) });
const get = <T>(path: string, query?: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return request<T>(s ? `${path}?${s}` : path);
};
const post = <T>(path: string, data?: unknown) => request<T>(path, json("POST", data));
const patch = <T>(path: string, data: unknown) => request<T>(path, json("PATCH", data));
const upload = <T>(path: string, fields: Record<string, string | Blob>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return request<T>(path, { method: "POST", body: form });
};

// ---------------------------------------------------------------- auth

export const login = (email: string, password: string, remember: boolean) => post<{ ok: true }>("/api/auth/login", { email, password, remember });
export const register = (b: { kind: CustomerKind; displayName: string; contactPerson?: string; email: string; password: string; acceptTerms: true }) => post<{ userId: string }>("/api/auth/register", b);
export const verifyEmail = (code: string) => post<{ emailVerified: true }>("/api/auth/verify-email", { code });
export const resendEmailCode = () => post<{ retryAfterSec: number }>("/api/auth/resend-email-code");
export const startPhone = (phone: string) => post<{ phoneMasked: string; retryAfterSec: number }>("/api/auth/phone", { phone });
export const verifyPhone = (otp: string) => post<{ phoneVerified: true }>("/api/auth/verify-phone", { otp });
export const resendOtp = () => post<{ retryAfterSec: number }>("/api/auth/resend-otp");
export const logout = () => post<void>("/api/auth/logout");
export const forgotPassword = (email: string) => post<{ ok: true }>("/api/auth/forgot-password", { email });
export const resetPassword = (token: string, password: string) => post<{ ok: true }>("/api/auth/reset-password", { token, password });
export const completeGoogleSignup = (b: { kind: CustomerKind; agencyName?: string; acceptTerms: true }) => post<{ ok: true }>("/api/auth/google/complete", b);

/** Google sign-in starts with a full-page navigation, not a fetch. */
export function googleHref(opts: { type?: "seller" | "agency"; next?: string } = {}): string {
  const p = new URLSearchParams();
  if (opts.type) p.set("type", opts.type);
  if (opts.next) p.set("next", opts.next);
  const s = p.toString();
  return `/api/auth/google${s ? `?${s}` : ""}`;
}

// ---------------------------------------------------------------- account

export const updateMe = (b: { displayName?: string; contactPerson?: string; email?: string; city?: string | null }) => patch<Me>("/api/me", b);
export const changePassword = (currentPassword: string, newPassword: string) => patch<void>("/api/me/password", { currentPassword, newPassword });
export const setNotificationSettings = (b: Partial<NotificationSettings>) => patch<NotificationSettings>("/api/me/notification-settings", b);
export const deleteAccount = (password: string) => request<void>("/api/me", json("DELETE", { password }));

// ---------------------------------------------------------------- leads

export type LeadQuery = { stage?: string; listing?: string; q?: string; page?: number; pageSize?: number };
export const patchLead = (id: string, b: { customerStage?: CustomerStage; note?: string; followUpAt?: string | null; followUpKind?: FollowUpKind | null }) => patch<LeadDetail>(`/api/leads/${id}`, b);
export const reportLead = (id: string, reason: ReportReason, details?: string) => post<{ report: { status: "OPEN" } }>(`/api/leads/${id}/report`, { reason, details });

/** Download link, not a fetch. */
export function leadsExportHref(q: LeadQuery): string {
  const p = new URLSearchParams();
  if (q.stage) p.set("stage", q.stage);
  if (q.listing) p.set("listing", q.listing);
  if (q.q) p.set("q", q.q);
  const s = p.toString();
  return `/api/leads/export.csv${s ? `?${s}` : ""}`;
}

// ---------------------------------------------------------------- listings

export const createListing = (category: ListingCategory) => post<{ id: string }>("/api/listings", { category });
export const getListing = (id: string) => get<ListingDetail>(`/api/listings/${id}`);
export const patchListing = (id: string, b: ListingPatch) => patch<ListingDetail>(`/api/listings/${id}`, b);
export const submitListing = (id: string) => post<{ status: ListingStatus }>(`/api/listings/${id}/submit`);
export const listingAction = (id: string, action: "pause" | "resume" | "mark-sold") => post<{ status: ListingStatus }>(`/api/listings/${id}/status`, { action });
export const uploadListingImage = (id: string, file: File) => upload<{ image: { id: string; url: string; position: number } }>(`/api/listings/${id}/images`, { file });
export const deleteListingImage = (id: string, imageId: string) => request<void>(`/api/listings/${id}/images/${imageId}`, { method: "DELETE" });
export const reorderListingImages = (id: string, ids: string[]) => patch<void>(`/api/listings/${id}/images/order`, { ids });
export const uploadListingDocument = (id: string, kind: DocumentKind, file: File) =>
  upload<{ document: { id: string; kind: DocumentKind; fileName: string; uploadedAt: string } }>(`/api/listings/${id}/documents`, { file, kind });
export const getLocalities = (region: string, q?: string) => get<{ items: Locality[] }>("/api/localities", { region, q });

// ---------------------------------------------------------------- orders

export const createOrder = (listingId: string, packagePlanId: string) => post<{ orderId: string }>("/api/orders", { listingId, packagePlanId });
export const getOrder = (id: string) => get<OrderDetail>(`/api/orders/${id}`);
export const payOrder = (id: string, method: PaymentMethod) => post<PayResult>(`/api/orders/${id}/pay`, { method });

// ---------------------------------------------------------------- notifications

export const getNotifications = (q: { type?: string; cursor?: string }) => get<{ items: NotificationItem[]; nextCursor: string | null; unread: number }>("/api/notifications", q);
export const readAllNotifications = () => post<void>("/api/notifications/read-all");
export const readNotification = (id: string) => request<void>(`/api/notifications/${id}`, { method: "PATCH" });
