import bcrypt from "bcryptjs";
import { seal } from "@/server/crypto/aead";
import type { SeedContext } from "./context";
import team from "./team.json";

/** Admin accounts with a known password and authenticator secret (dev only). Upsert by email. */
export async function seedTeam({ prisma }: SeedContext) {
  const key = process.env.TOTP_ENC_KEY;
  if (!key) throw new Error("TOTP_ENC_KEY must be set to seed admin accounts.");
  const passwordHash = await bcrypt.hash(team.password, 12);
  for (const p of team.people) {
    const data = { fullName: p.name, role: "ADMIN" as const, status: "ACTIVE" as const, passwordHash, emailVerifiedAt: new Date(), totpSecretEnc: seal(p.totpSecret, key), totpEnabledAt: new Date() };
    await prisma.user.upsert({ where: { email: p.email }, create: { email: p.email, ...data }, update: data });
  }
  return team.people.length;
}
