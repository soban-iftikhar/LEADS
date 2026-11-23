"use client";

import { Button } from "./Button";

/** What went wrong and a way to try again. Used by route error boundaries. */
export function ErrorState({ title = "Couldn't load this", detail, onRetry }: { title?: string; detail?: string; onRetry: () => void }) {
  return (
    <div className="err-state" role="alert">
      <b>{title}</b>
      <span>{detail ?? "The server didn't answer in time or something broke on our side. Your data is safe."}</span>
      <Button size="sm" icon="refresh" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
