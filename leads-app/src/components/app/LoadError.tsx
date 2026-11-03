"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";

/** Page-level fetch error: warn note with a retry. */
export function LoadError() {
  const router = useRouter();
  return (
    <Note tone="warn" icon="alert" role="alert">
      <div className="between" style={{ flexWrap: "wrap" }}>
        <span>Couldn&apos;t load this.</span>
        <Button size="sm" onClick={() => router.refresh()} icon="refresh">
          Try again
        </Button>
      </div>
    </Note>
  );
}
