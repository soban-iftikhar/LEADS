import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { allAreaSlugs, localityBySlug } from "@/lib/areas";
import { getViewer } from "@/lib/viewer";

type Params = { city: string; area: string };

export function generateStaticParams() {
  return allAreaSlugs();
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city, area } = await params;
  const loc = localityBySlug(city, area);
  if (!loc) return {};
  return {
    title: { absolute: `Sell your property in ${loc.name}, ${loc.region} | LEADS` },
    description: `List your house or plot in ${loc.name}. LEADS messages people nearby who might buy it and sends you the ones who reply yes.`,
    alternates: { canonical: `/sell/${city}/${area}` },
  };
}

/** SEO area page. Stub content for now, built from the landing sections. */
export default async function AreaPage({ params }: { params: Promise<Params> }) {
  const { city, area } = await params;
  if (city !== "islamabad" && city !== "rawalpindi") notFound();
  const loc = localityBySlug(city, area);
  if (!loc) notFound();
  const viewer = await getViewer();
  return (
    <>
      <MarketingHeader signedIn={!!viewer} home={false} />
      <main>
        <section className="sec" aria-labelledby="area-h" style={{ paddingBottom: "clamp(48px,6vw,80px)" }}>
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
            <span className="chip" style={{ alignSelf: "flex-start" }}>
              <i />
              {loc.name}, {loc.region}
            </span>
            <h1 id="area-h" className="h2" style={{ margin: 0 }}>
              Sell your property in <span className="mk go">{loc.name}.</span>
            </h1>
            <p className="lead">
              List your house or plot. We message people who might buy it, and send you only the ones who say <b style={{ color: "var(--ink)" }}>&quot;yes, I&apos;m interested.&quot;</b>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href={viewer ? "/listings/new" : "/signup"} className="btn b-m np">
                List your property
              </Link>
              <Link href="/#how" className="btn np">
                How it works
              </Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
