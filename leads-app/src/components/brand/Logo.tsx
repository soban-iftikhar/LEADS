/** The LEADS mark: yellow tile, house with a pin. `ping` adds the pulse used in the landing header. */
export function LogoMark({ size = 42, ping, rounded = true }: { size?: number; ping?: boolean; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ overflow: "visible" }}>
      <rect width="48" height="48" rx={rounded ? 13 : 8} style={{ fill: "var(--m)" }} />
      <path d="M11 19.5 17.5 13 24 19.5V31h13v6H11z" style={{ fill: "var(--on-m)" }} />
      {ping && <circle className="ping" cx="32" cy="20" r="5" style={{ fill: "none", stroke: "var(--on-m)", strokeWidth: 1.5 }} />}
      <circle cx="32" cy="20" r="5" style={{ fill: "var(--m-tint)" }} />
    </svg>
  );
}
