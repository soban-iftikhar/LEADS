import "server-only";
import { prisma } from "@/server/db";

/** The three counters on the admin menu: listings waiting, replies the AI wasn't sure about, open reports. */
export async function adminBadges() {
  const [review, replies, reports] = await Promise.all([
    prisma.listing.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.message.count({ where: { direction: "IN", needsReview: true } }),
    prisma.leadReport.count({ where: { status: "OPEN" } }),
  ]);
  return { review, replies, reports };
}
