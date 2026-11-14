import { Ghar } from "@/components/app/Ghar";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt" id="mkt-root" style={{ minHeight: "100%" }}>
      {children}
      <Ghar area="marketing" />
    </div>
  );
}
