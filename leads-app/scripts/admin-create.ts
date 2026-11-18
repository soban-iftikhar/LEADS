// Creates the first admin (DR-38: admins are never self-signed-up). Prints a one-time password and
// the authenticator setup link; both are shown once and stored only as a hash / ciphertext.
//
//   npm run admin:create -- --email ops@example.com --name "Ops Person"
import "dotenv/config";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { newTotpSecret } from "@/server/auth/totp";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Usage: npm run admin:create -- --email ops@example.com --name "Full Name"');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main(e: string, n: string) {
  if (await prisma.user.findUnique({ where: { email: e } })) throw new Error(`${e} already has an account.`);
  const password = crypto.randomBytes(18).toString("base64url");
  const totp = newTotpSecret(e);
  await prisma.user.create({
    data: { email: e, fullName: n, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: new Date(), totpSecretEnc: totp.secretEnc, totpEnabledAt: new Date() },
  });
  console.log(`Admin created: ${e}`);
  console.log(`Password (shown once, change it after signing in): ${password}`);
  console.log(`Authenticator setup (scan as a QR code or enter the secret): ${totp.uri}`);
}

main(email, name)
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
