"use server";

// Mock transport: server actions that front the in-memory store, so client mutations and
// server-rendered pages see the same data. TODO(api): remove when the contract endpoints exist.
import type {
  CustomerKind,
  CustomerStage,
  DocumentKind,
  LeadStageFilter,
  ListingCategory,
  ListingPatch,
  NotificationSettings,
  PaymentMethod,
  ReportReason,
} from "@/types/api";
import { clearMockSession, mockUserId, setMockSession } from "./session";
import * as S from "./store";

export type MockResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; errors: Record<string, string> | null };

async function run<T>(fn: () => T | Promise<T>): Promise<MockResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof S.MockError) return { ok: false, status: e.status, message: e.message, errors: e.errors };
    console.error(e);
    return { ok: false, status: 500, message: "Something went wrong. Please try again.", errors: null };
  }
}

async function uidOrThrow(): Promise<string> {
  const id = await mockUserId();
  if (!id) throw new S.MockError(401, "Please log in.");
  return id;
}

// auth
export const mLogin = async (email: string, password: string, remember: boolean) =>
  run(async () => {
    try {
      const r = S.login(email, password);
      await setMockSession(r.userId, remember);
      return r.me;
    } catch (e) {
      // phone not verified: session is still set so /signup/verify works (OTP re-sent)
      if (e instanceof S.MockError && e.status === 403 && e.errors?.userId) {
        await setMockSession(e.errors.userId, remember);
        throw new S.MockError(403, e.message, { requiresPhoneVerification: "true" });
      }
      throw e;
    }
  });
export const mRegister = async (input: { kind: CustomerKind; displayName: string; contactPerson?: string; email: string; phone: string; password: string; acceptTerms: true }) =>
  run(async () => {
    const r = S.register(input);
    await setMockSession(r.userId, false);
    return { userId: r.userId, phoneMasked: r.phoneMasked };
  });
export const mVerifyPhone = async (otp: string) => run(async () => S.verifyPhone(await uidOrThrow(), otp));
export const mResendOtp = async () => run(async () => S.resendOtp(await uidOrThrow()));
export const mPhone = async () => run(async () => S.phoneOf(await uidOrThrow()));
export const mLogout = async () => run(async () => clearMockSession());
export const mForgot = async (email: string) => run(() => (void email, {}));
export const mReset = async (token: string, password: string) => run(() => S.resetPassword(token, password));
export const mVerifyEmail = async (token: string) => run(() => S.verifyEmailToken(token));
export const mMe = async () => run(async () => S.me(await uidOrThrow()));
export const mUpdateMe = async (patch: { displayName?: string; contactPerson?: string; email?: string; phone?: string }) => run(async () => S.updateMe(await uidOrThrow(), patch));
export const mChangePassword = async (currentPassword: string, newPassword: string) => run(async () => S.changePassword(await uidOrThrow(), currentPassword, newPassword));
export const mGetPrefs = async () => run(async () => S.getPrefs(await uidOrThrow()));
export const mSetPrefs = async (patch: Partial<NotificationSettings>) => run(async () => S.setPrefs(await uidOrThrow(), patch));
export const mDeleteMe = async (password: string) =>
  run(async () => {
    S.deleteMe(await uidOrThrow(), password);
    await clearMockSession();
  });

// dashboard
export const mSummary = async () => run(async () => S.dashboardSummary(await uidOrThrow()));

// leads
export const mLeads = async (q: { stage?: LeadStageFilter; listing?: string; q?: string; page?: number; pageSize?: number }) => run(async () => S.listLeads(await uidOrThrow(), q));
export const mLead = async (id: string) => run(async () => S.getLead(await uidOrThrow(), id));
export const mPatchLead = async (id: string, patch: { customerStage?: CustomerStage; note?: string; followUpAt?: string | null }) => run(async () => S.patchLead(await uidOrThrow(), id, patch));
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
