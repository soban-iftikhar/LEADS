"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
