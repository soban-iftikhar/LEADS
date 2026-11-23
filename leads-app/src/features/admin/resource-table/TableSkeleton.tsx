import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state of a list screen: title, optional KPI boxes, toolbar and rows. */
export function TableSkeleton({ kpis = false, rows = 8 }: { kpis?: boolean; rows?: number }) {
  return (
    <>
      <Skeleton w={260} h={34} />
      {kpis && (
        <div className="kpis k3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={96} />
          ))}
        </div>
      )}
      <section className="card" aria-busy="true" aria-label="Loading">
        <div className="tool">
          <Skeleton w={280} h={36} />
          <Skeleton w={240} h={36} style={{ marginLeft: "auto" }} />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
            <Skeleton h={24} />
          </div>
        ))}
      </section>
    </>
  );
}
