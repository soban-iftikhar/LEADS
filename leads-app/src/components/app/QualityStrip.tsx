import { Icon } from "@/components/ui/Icon";
import type { QualityCheck } from "@/types/api";

/** "Quality check 4 / 6" + one pill per check. Submit unlocks when every check passes. */
export function QualityStrip({ checks, id, photoCount }: { checks: QualityCheck[]; id: string; photoCount: number }) {
  const passed = checks.filter((c) => c.passed).length;
  return (
    <section className="sec" aria-label="Quality check">
      <div className="sec-b">
        <div className="between" style={{ flexWrap: "wrap", gap: 14 }}>
          <div className="qstrip" id={id} aria-live="polite">
            <b style={{ fontSize: 15 }}>
              Quality check <span className="mono">{`${passed} / ${checks.length}`}</span>
            </b>
            {checks.map((c) => (
              <span key={c.key} className={`qi ${c.passed ? "" : "n"}`}>
                <Icon name={c.passed ? "check" : "x"} size={14} strokeWidth={3} />
                {c.key === "photos" && !c.passed ? `5 photos (${photoCount} added)` : c.label}
                <span className="sr-only">{c.passed ? " passes" : " missing"}</span>
              </span>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {passed === checks.length ? "Ready to submit" : `Submit unlocks when all ${checks.length} pass`}
          </span>
        </div>
      </div>
    </section>
  );
}
