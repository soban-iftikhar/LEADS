import "server-only";
import { prisma } from "@/server/db";
import { notArchived } from "@/server/db/soft-delete";

/** The three counters on the admin menu: listings waiting, replies the AI wasn't sure about, open reports. */
export async function adminBadges() {
  const [review, replies, reports] = await Promise.all([
    prisma.listing.count({ where: { status: "UNDER_REVIEW", ...notArchived() } }),
    prisma.message.count({ where: { direction: "IN", needsReview: true } }),
    prisma.leadReport.count({ where: { status: "OPEN", ...notArchived() } }),
  ]);
  return { review, replies, reports };
}
