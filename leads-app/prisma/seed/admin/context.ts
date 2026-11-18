import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/** What every fixture loader gets: one client and the clock the fixtures are relative to. */
export type SeedContext = { prisma: PrismaClient; now: Date };

export function createContext(): SeedContext {
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) }), now: new Date() };
}

export const DAY_MS = 86_400_000;
export const daysAgo = (ctx: SeedContext, days: number) => new Date(ctx.now.getTime() - days * DAY_MS);
