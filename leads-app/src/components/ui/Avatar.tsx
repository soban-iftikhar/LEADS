import { cx } from "./cx";

export type AvatarTone = "y" | "t" | "k" | "";

/** Stable tone from an id, so the same buyer always gets the same colour. */
export function toneFor(id: string): AvatarTone {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (["y", "t", "", "k", ""] as const)[Math.abs(h) % 5];
}

export function Avatar({ initials, tone = "", size = 40 }: { initials: string; tone?: AvatarTone; size?: 36 | 40 | 56 }) {
  return (
    <span
      className={cx("av", tone)}
      aria-hidden="true"
      style={size !== 40 ? { width: size, height: size, fontSize: size === 56 ? 17 : 12.5 } : undefined}
    >
      {initials}
    </span>
  );
}
