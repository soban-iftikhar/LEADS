"use client";

type Props = {
  count: number;
  actionLabel?: string;
  onAction?: () => void;
  archiveLabel?: "Archive" | "Restore";
  onArchive?: () => void;
  onClear: () => void;
  disabled?: string;
};

/** Dark bar over the table while rows are ticked. */
export function BulkBar({ count, actionLabel, onAction, archiveLabel, onArchive, onClear, disabled }: Props) {
  return (
    <div className="bulk" role="region" aria-label="Selected rows">
      <span aria-live="polite">{count} selected</span>
      <span style={{ flex: 1 }} />
      {actionLabel && onAction && (
        <button className="btn pri" type="button" onClick={onAction} aria-disabled={!!disabled || undefined} title={disabled}>
          {actionLabel}
        </button>
      )}
      {archiveLabel && onArchive && (
        <button className="btn ghost" type="button" onClick={onArchive} aria-disabled={!!disabled || undefined} title={disabled}>
          {archiveLabel}
        </button>
      )}
      <button className="btn ghost" type="button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
