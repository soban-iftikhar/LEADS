import type { Role } from "@prisma/client";

/**
 * Who may do what (DR-39, SPEC_02 5.1). Route handlers ask for a permission; they never compare
 * roles. Ownership (`:own`) is enforced by the services, which scope every query by the caller's id.
 */

const OWN_ACCOUNT = ["profile:read:own", "profile:update:own", "session:manage:own", "account:delete:own"] as const;
const CUSTOMER = [
  "listing:create",
  "listing:read:own",
  "listing:update:own",
  "listing:submit:own",
  "listing:pause:own",
  "lead:read:own",
  "lead:update:own",
  "order:create",
  "order:read:own",
  "notification:read:own",
] as const;
const BUYER = ["listing:save", "inquiry:create"] as const;
const ADMIN = ["listing:read:any", "listing:review", "user:read:any", "user:update:any", "user:suspend", "session:revoke:any", "payment:confirm", "audit:read"] as const;

export type Permission = (typeof OWN_ACCOUNT)[number] | (typeof CUSTOMER)[number] | (typeof BUYER)[number] | (typeof ADMIN)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  CUSTOMER_SELLER: [...OWN_ACCOUNT, ...CUSTOMER],
  CUSTOMER_AGENCY: [...OWN_ACCOUNT, ...CUSTOMER],
  BUYER: [...OWN_ACCOUNT, ...BUYER],
  ADMIN: [...OWN_ACCOUNT, ...ADMIN],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return MATRIX[role];
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

/** Account housekeeping works before the email is confirmed (so the code screen can change it). */
export function needsVerifiedEmail(permission: Permission): boolean {
  return !(OWN_ACCOUNT as readonly string[]).includes(permission);
}
