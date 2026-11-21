import { Ghar } from "@/components/app/Ghar";
import { activeRegions } from "@/server/modules/catalog/service";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const cities = await activeRegions().then((r) => r.map((c) => c.name)).catch(() => []);
  return (
    <div className="mkt" id="mkt-root" style={{ minHeight: "100%" }}>
      {children}
      <Ghar area="marketing" cities={cities} />
    </div>
  );
}
