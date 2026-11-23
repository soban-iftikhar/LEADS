"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TrendSeries } from "@/components/charts/TrendChart";

// the chart is the heaviest client part of the page: load it on its own
const TrendChart = dynamic(() => import("@/components/charts/TrendChart").then((m) => m.TrendChart), { ssr: false, loading: () => <Skeleton h={340} /> });

type Props = { labels: string[]; series: TrendSeries[]; median: (number | null)[]; medianLabel: string; mode: "price" | "change" };

export function PriceTrends(props: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const open = (slug: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set("area", slug);
    router.replace(`${path}?${q.toString()}`, { scroll: false });
  };
  return <TrendChart {...props} onOpen={open} emptyText="Pick at least one area" />;
}
