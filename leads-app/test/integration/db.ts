import { prisma } from "@/server/db";

/** Empties the identity tables between tests. Config rows (settings, regions) are kept. */
export async function resetIdentity(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE app.recovery_codes, app.sessions, app.verification_tokens, app.customer_profiles,
             app.buyer_profiles, app.users, ops.audit_log CASCADE`);
}

export async function insertUser(fields: {
  role: "CUSTOMER_SELLER" | "CUSTOMER_AGENCY" | "BUYER" | "ADMIN";
  email?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  deletedAt?: Date | null;
}): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO app.users (email, full_name, password_hash, role, status, deleted_at)
     VALUES ($1, 'Test User', 'x', $2::app."Role", $3::app."UserStatus", $4) RETURNING id`,
    fields.email ?? `u${Math.random().toString(36).slice(2)}@test.leads`,
    fields.role,
    fields.status ?? "ACTIVE",
    fields.deletedAt ?? null,
  );
  return rows[0].id;
}
