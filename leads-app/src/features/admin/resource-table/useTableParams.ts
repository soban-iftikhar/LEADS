"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { listQuery, type ListParams } from "@/lib/admin/resource";

/**
 * The list's state lives in the URL. Changing a tab, filter or search goes back to page 1;
 * replace (not push) so Back leaves the list instead of undoing each keystroke.
 */
export function useTableParams(params: ListParams) {
  const router = useRouter();
  const path = usePathname();
  const [pending, startTransition] = useTransition();

  const hrefFor = useCallback(
    (patch: Partial<ListParams>) => {
      const resetsPage = "q" in patch || "tab" in patch || "filter" in patch;
      const qs = listQuery({ ...params, ...(resetsPage ? { page: 1 } : {}), ...patch });
      return qs ? `${path}?${qs}` : path;
    },
    [params, path],
  );

  const set = useCallback(
    (patch: Partial<ListParams>) => startTransition(() => router.replace(hrefFor(patch), { scroll: false })),
    [hrefFor, router],
  );

  return { pending, set, hrefFor };
}
