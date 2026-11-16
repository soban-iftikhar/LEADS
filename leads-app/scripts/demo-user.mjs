// Creates (or resets) the two demo customers used in development and the Playwright tests:
//   demo@leads.pk / password1  agency "Al-Noor Estate"
//   owner@leads.pk / password1 owner  "Soban Iftikhar"
// Email and WhatsApp verified.
// The mock leads/listings/orders attach to this account by email. Never run against production.
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create a demo user in production.");
  process.exit(1);
}
const { PHONE_HASH_PEPPER, PHONE_ENC_KEY } = process.env;
if (!PHONE_HASH_PEPPER || !PHONE_ENC_KEY) {
  console.error("PHONE_HASH_PEPPER and PHONE_ENC_KEY must be set (same as python-service/.env).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function phoneFields(phone) {
  const phoneHash = crypto.createHmac("sha256", Buffer.from(PHONE_HASH_PEPPER, "base64")).update(phone).digest("hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(PHONE_ENC_KEY, "base64"), iv);
  const ct = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  return { phoneHash, phoneEnc: Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64"), phoneVerifiedAt: new Date() };
}

// fake numbers used only by the demo accounts
const ACCOUNTS = [
  { email: "demo@leads.pk", phone: "03001112233", fullName: "Imran Qureshi", role: "CUSTOMER_AGENCY", profile: { kind: "AGENCY", displayName: "Al-Noor Estate", contactPerson: "Imran Qureshi" } },
  { email: "owner@leads.pk", phone: "03001112244", fullName: "Soban Iftikhar", role: "CUSTOMER_SELLER", profile: { kind: "SELLER", displayName: "Soban Iftikhar", contactPerson: null } },
];

const passwordHash = await bcrypt.hash("password1", 12);
for (const a of ACCOUNTS) {
  const data = {
    fullName: a.fullName,
    passwordHash,
    role: a.role,
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
    ...phoneFields(a.phone),
    failedLoginCount: 0,
    lockedUntil: null,
    termsAcceptedAt: new Date(),
    termsVersion: "2026-11",
  };
  const profile = { ...a.profile, areas: [], propertyTypes: [] };
  const user = await prisma.user.upsert({
    where: { email: a.email },
    create: { email: a.email, ...data, customer: { create: profile } },
    update: { ...data, customer: { upsert: { create: profile, update: profile } } },
  });
  console.log(`Demo user ready: ${a.email} / password1 (id ${user.id})`);
}
await prisma.$disconnect();
