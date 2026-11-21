import "server-only";
import type { Prisma, User } from "@prisma/client";
import { verifyPassword } from "@/server/auth/password";
import { revokeAllSessions } from "@/server/auth/session";
import { revealPhone } from "@/server/crypto/phone";
import { prisma } from "@/server/db";
import { AppError, badInput, conflict } from "@/server/http/errors";
import { sendVerifyEmail, unusableHash } from "@/server/modules/auth/service";
import { countNewLeads, initialsOf } from "@/server/modules/leads/service";
import { countMyListings, type Owner } from "@/server/modules/listings/service";
import { unreadCount } from "@/server/modules/notifications/service";
import { hasActivePackage } from "@/server/modules/orders/service";
import { maskPhone } from "@/lib/format";
import type { Me, NotificationSettings } from "@/types/api";

export const DEFAULT_PREFS: NotificationSettings = { newLeadWhatsapp: true, dailySummary: true, listingUpdates: true, emailCopies: false, packageEnding: true };

type CustomerUser = User & { customer: Prisma.CustomerProfileGetPayload<{ include: { region: { select: { slug: true } } } }> };

/** The signed-in customer with their profile, or a 403 for accounts that aren't customers. */
export async function customerById(id: string): Promise<CustomerUser> {
  const u = await prisma.user.findUnique({ where: { id }, include: { customer: { include: { region: { select: { slug: true } } } } } });
  if (!u?.customer || (u.role !== "CUSTOMER_SELLER" && u.role !== "CUSTOMER_AGENCY")) throw new AppError(403, "This account can't use the customer app.");
  return u as CustomerUser;
}

/** The listing owner as the listings service needs it. */
export const ownerOf = (u: Pick<User, "id" | "phoneVerifiedAt"> & { customer: { kind: "SELLER" | "AGENCY" } | null }): Owner => ({
  id: u.id,
  kind: u.customer?.kind ?? "SELLER",
  phoneVerified: !!u.phoneVerifiedAt,
});

export async function getMe(userId: string): Promise<Me> {
  const u = await customerById(userId);
  const [newLeads, unreadNotifications, listings] = await Promise.all([countNewLeads(u.id), unreadCount(u.id), countMyListings(u.id)]);
  const phone = revealPhone(u.phoneEnc);
  return {
    user: { id: u.id, email: u.email, role: u.role as Me["user"]["role"], phoneMasked: phone ? maskPhone(phone) : null, emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt },
    customer: { kind: u.customer.kind, displayName: u.customer.displayName, contactPerson: u.customer.contactPerson, initials: initialsOf(u.customer.displayName), city: u.customer.region?.slug ?? null },
    counts: { newLeads, unreadNotifications, listings },
  };
}

export async function updateProfile(userId: string, patch: { displayName?: string; contactPerson?: string; email?: string; city?: string | null }): Promise<Me> {
  const u = await customerById(userId);
  const agency = u.customer.kind === "AGENCY";
  const emailChanged = !!patch.email && patch.email !== u.email;
  if (emailChanged && (await prisma.user.findUnique({ where: { email: patch.email }, select: { id: true } }))) {
    throw conflict("This email already has an account.", { email: "This email already has an account." });
  }
  let regionId: string | null | undefined;
  if (patch.city !== undefined) {
    const region = patch.city ? await prisma.region.findFirst({ where: { slug: patch.city, active: true }, select: { id: true } }) : null;
    if (patch.city && !region) throw badInput({ city: "Pick a city from the list." });
    regionId = region?.id ?? null;
  }
  const updated = await prisma.user.update({
    where: { id: u.id },
    data: {
      ...(emailChanged ? { email: patch.email, emailVerifiedAt: null } : {}),
      ...(agency && patch.contactPerson ? { fullName: patch.contactPerson } : {}),
      ...(!agency && patch.displayName ? { fullName: patch.displayName } : {}),
      customer: {
        update: {
          ...(patch.displayName ? { displayName: patch.displayName } : {}),
          ...(agency && patch.contactPerson ? { contactPerson: patch.contactPerson } : {}),
          ...(regionId !== undefined ? { regionId } : {}),
        },
      },
    },
  });
  if (emailChanged) await sendVerifyEmail(updated, true);
  return getMe(u.id);
}

export async function getPrefs(userId: string): Promise<NotificationSettings> {
  const u = await customerById(userId);
  return { ...DEFAULT_PREFS, ...(u.customer.notificationPrefs as Partial<NotificationSettings>) };
}

export async function setPrefs(userId: string, patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const next = { ...(await getPrefs(userId)), ...patch };
  await prisma.customerProfile.update({ where: { userId }, data: { notificationPrefs: next } });
  return next;
}

/** SPEC_02 5.10: anonymise, revoke every session, archive listings. Orders and leads stay. */
export async function deleteAccount(user: User, password: string): Promise<void> {
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError(422, "That password is wrong.", { password: "That password is wrong." });
  if (await hasActivePackage(user.id)) throw conflict("You have an active package.");
  const passwordHash = await unusableHash();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { status: "DELETED", deletedAt: new Date(), email: `deleted+${user.id}@invalid.leads`, fullName: "Deleted user", phoneHash: null, phoneEnc: null, phoneVerifiedAt: null, passwordHash, totpSecretEnc: null, totpEnabledAt: null },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.oAuthAccount.deleteMany({ where: { userId: user.id } }),
    prisma.listing.updateMany({ where: { customerId: user.id }, data: { status: "ARCHIVED" } }),
    prisma.order.updateMany({ where: { customerId: user.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } }),
  ]);
  await revokeAllSessions(user.id, "deleted");
}
