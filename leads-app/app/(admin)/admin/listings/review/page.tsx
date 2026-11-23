import type { Metadata } from "next";
import { approveListingsAction } from "@/features/admin/review-queue/actions";
import { reviewConfig } from "@/features/admin/review-queue/config";
import { getReviewQueue } from "@/features/admin/review-queue/queries";
import { ResourceTable } from "@/features/admin/resource-table/ResourceTable";
import { parseListParams } from "@/lib/admin/resource";

export const metadata: Metadata = { title: "Review queue" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewQueuePage({ searchParams }: { searchParams: SP }) {
  const params = parseListParams(await searchParams);
  return <ResourceTable config={reviewConfig} result={await getReviewQueue(params)} params={params} rowAction={approveListingsAction} />;
}
