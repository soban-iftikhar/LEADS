import "server-only";
import type { User } from "@prisma/client";
import * as S from "./store";

type WithProfile = User & { customer: { kind: "SELLER" | "AGENCY"; displayName: string; contactPerson: string | null } | null };

/** Mirrors a real user into the mock store and returns their mock-side counts. TODO(api): drop with the mocks. */
export function mockCounts(u: WithProfile) {
  if (!u.customer) return { newLeads: 0, unreadNotifications: 0, listings: 0 };
  S.syncUser({ id: u.id, email: u.email, kind: u.customer.kind, displayName: u.customer.displayName, contactPerson: u.customer.contactPerson, phoneVerified: !!u.phoneVerifiedAt });
  return S.counts(u.id);
}

export function mockHasActivePackage(u: WithProfile): boolean {
  mockCounts(u);
  return S.hasActivePackage(u.id);
}
