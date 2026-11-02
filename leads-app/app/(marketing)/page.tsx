import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { AgencyTabs } from "@/components/marketing/AgencyTabs";
import { FlowBar } from "@/components/marketing/FlowBar";
import { HeroStory } from "@/components/marketing/HeroStory";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { PhoneMock } from "@/components/marketing/PhoneMock";
import { PromiseSlider } from "@/components/marketing/PromiseSlider";
import { Reveals } from "@/components/marketing/Reveals";
import { FAQS, faqJsonLd, orgJsonLd, serviceJsonLd } from "@/components/marketing/content";
import { getPackagePlans } from "@/lib/api";
import { groupPk } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import type { PackagePlan } from "@/types/api";

export const metadata: Metadata = {
  title: { absolute: "Sell your property in Islamabad and Rawalpindi | LEADS" },
  description:
    "List your house or plot in Islamabad or Rawalpindi. LEADS messages people who might buy it and sends you the ones who reply yes. Pay for real buyers, not ads.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sell your property in Islamabad and Rawalpindi | LEADS",
    description: "We find the buyers. You close the deal. Pay only for people who said yes.",
    type: "website",
  },
};

const Check = ({ dark }: { dark?: boolean }) => (
  <span style={{ width: dark ? 20 : 26, height: dark ? 20 : 26, borderRadius: dark ? 6 : 8, background: "var(--m)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
    <svg width={dark ? 13 : 16} height={dark ? 13 : 16} viewBox="0 0 24 24" fill="none" stroke="var(--on-m)" strokeWidth={dark ? 3 : 2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  </span>
);

const Arrow = () => (
  <span className="ar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  </span>
);

const HEADLINE = ["We", "find", "the", "buyers.", "You", "close", "the", "deal."];

const CALLS = [
  { text: "Is it still available?", time: "09:12", d: 0 },
  { text: "Final price kya hai?", time: "11:40", d: 650 },
  { text: "Missed call", time: "13:05", d: 1300 },
  { text: "Just checking, thanks", time: "16:22", d: 1950 },
];

const STEPS = [
  { n: "01", who: "You", ink: true, d: "", anim: "a-build", ad: 0, title: "Add your property", text: "Price, size, location and a few good photos. We check it before it goes live, so buyers trust it.", icon: "M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M12 11v6M9 14h6" },
  { n: "02", who: "LEADS", ink: false, d: "d1", anim: "a-scan", ad: 300, title: "We find likely buyers", text: "People who own similar homes nearby are often ready to move. We find them and pick the best matches.", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM20 20l-4-4" },
  { n: "03", who: "LEADS", ink: false, d: "d2", anim: "a-msg", ad: 600, title: "We message them", text: "A short WhatsApp about your property. We read every reply, so you never have to.", icon: "M4 20l1.3-3.9A8 8 0 1 1 8 19z" },
  { n: "04", who: "You", ink: true, d: "d3", anim: "a-ring", ad: 900, title: "You get the buyer", text: "When someone says yes, you get their name, number and what they said. Then it is your call.", icon: "M5 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" },
];

const GET_LIST = ["Their name and phone number", "Their reply, word for word", "Their budget and when they want to buy", "A bad lead? Report it and we give it back"];

const PLAN_COPY: Record<string, { for: string; feats: string[]; pop: boolean }> = {
  Starter: { for: "One house, first time", feats: ["One property", "60-day delivery", "Money back for missed leads"], pop: false },
  Growth: { for: "For a faster sale", feats: ["One property", "Matched first", "60-day delivery", "Money back for missed leads"], pop: true },
  Agency: { for: "Many listings, one account", feats: ["Spread across your listings", "60-day delivery", "Money back for missed leads"], pop: false },
};

async function plans(): Promise<PackagePlan[]> {
  try {
    return (await getPackagePlans()).items;
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const [viewer, planList] = await Promise.all([getViewer(), plans()]);
  const signedIn = !!viewer;
  const startHref = signedIn ? "/listings/new" : "/signup";
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([orgJsonLd(), serviceJsonLd(), faqJsonLd()]) }} />
      <Reveals rootId="mkt-page" />
      <div id="mkt-page">
        <MarketingHeader signedIn={signedIn} />
        <main>
          <section aria-labelledby="h1" style={{ padding: "clamp(28px,4vw,56px) 0 clamp(48px,6vw,80px)" }}>
            <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(24px,3vw,48px)", alignItems: "center" }}>
              <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                <span className="chip rise" style={{ animationDelay: ".1s" }}>
                  <i />
                  Islamabad &amp; Rawalpindi
                </span>
                <h1 id="h1" style={{ margin: "24px 0 0", fontWeight: 900, fontSize: "clamp(46px,5.4vw,88px)", lineHeight: 0.94, letterSpacing: "-.06em" }}>
                  {HEADLINE.map((w, i) => (
                    <Fragment key={w + i}>
                      {i > 0 && " "}
                      <span className={w === "buyers." ? "w mk go" : "w"} style={{ animationDelay: `${(0.2 + i * 0.07 + (i > 3 ? 0.02 : 0)).toFixed(2)}s` }}>
                        {w}
                      </span>
                    </Fragment>
                  ))}
                </h1>
                <p className="lead rise" style={{ marginTop: 24, animationDelay: ".9s" }}>
                  List your house or plot. We message people who might buy it, and send you only the ones who say <b style={{ color: "var(--ink)" }}>&quot;yes, I&apos;m interested.&quot;</b>
                </p>
                <div className="rise" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30, animationDelay: "1s" }}>
                  <Link href={startHref} className="btn b-m">
                    List your property
                    <Arrow />
                  </Link>
                  <a href="#pricing" className="btn np">
                    See pricing
                  </a>
                </div>
                <dl className="rise" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18, margin: "40px 0 0", paddingTop: 22, borderTop: "1px solid var(--line)", animationDelay: "1.1s" }}>
                  {[
                    ["Real replies", "Only people who said yes"],
                    ["Yours alone", "Each buyer goes to one seller"],
                    ["60 days", "Or money back for the gap"],
                  ].map(([t, d]) => (
                    <div key={t}>
                      <dt style={{ fontWeight: 800, fontSize: 15 }}>{t}</dt>
                      <dd style={{ margin: "3px 0 0", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.45 }}>{d}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <HeroStory />
            </div>
          </section>

          <FlowBar />

          <section className="sec" aria-labelledby="pain">
            <div className="wrap">
              <div data-rv="pain" data-rv-group="pain" className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px 64px", marginBottom: "clamp(40px,5vw,64px)" }}>
                <div style={{ flex: "1 1 560px" }}>
                  <p className="kicker">Sound familiar?</p>
                  <h2 id="pain" className="h2">
                    Listing on a portal usually goes <span className="mk">like this.</span>
                  </h2>
                </div>
                <p className="lead" style={{ flex: "0 1 420px" }}>
                  Lots of calls, very few visits. Most people are only checking prices, and your number ends up everywhere.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
                <div data-rv-group="pain" className="card lift rv d1" style={{ padding: 28 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {CALLS.map((c) => (
                      <div key={c.time} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 14, background: "var(--bg)" }}>
                        <svg className="ringi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true" style={{ animationDelay: `${c.d}ms` }}>
                          <path d="M5 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" />
                        </svg>
                        <span style={{ flex: 1, fontSize: 14.5 }}>{c.text}</span>
                        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{c.time}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "20px 0 0", fontWeight: 700, fontSize: 18 }}>&quot;Is it still available?&quot;</p>
                  <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 15 }}>The same question, all day.</p>
                </div>
                <div data-rv-group="pain" className="card lift rv d2" style={{ padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 160 }}>
                    {[
                      { h: 150, bg: "var(--line-2)", d: 300, l: "40 calls" },
                      { h: 16, bg: "var(--ink-3)", d: 700, l: "2 visits" },
                      { h: 4, bg: "var(--m)", d: 1100, l: "0 offers" },
                    ].map((b) => (
                      <div key={b.l} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <div className="bar" style={{ width: "100%", height: b.h, borderRadius: 12, background: b.bg, transitionDelay: `${b.d}ms` }} />
                        <span className="mono" style={{ fontSize: 13 }}>{b.l}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>A busy month. Nothing sold.</p>
                    <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 15 }}>Your time goes to people who were never going to buy.</p>
                  </div>
                </div>
                <div data-rv-group="pain" className="card lift rv d3" style={{ padding: 28, background: "var(--panel)", color: "var(--on-panel)", borderColor: "var(--line)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ alignSelf: "flex-start", maxWidth: "88%", padding: "11px 14px", borderRadius: "4px 16px 16px 16px", background: "var(--panel-2)", fontSize: 14.5, lineHeight: 1.45 }}>
                      A 10 Marla house in G-13/2 matches what you&apos;re looking for. Interested?
                    </div>
                    <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "11px 14px", borderRadius: "16px 4px 16px 16px", background: "var(--m)", color: "var(--hard)", fontSize: 15, fontWeight: 700 }}>
                      Ji, interested. Kab dekh sakte hain?
                    </div>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 20 }}>LEADS turns it around.</p>
                    <p style={{ margin: "4px 0 0", fontSize: 15, opacity: 0.8 }}>You don&apos;t wait for calls. You get people who already said yes.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="how" className="sec" style={{ paddingTop: 0 }} aria-labelledby="how-h">
            <div className="wrap">
              <div data-rv="how" data-rv-group="how" className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px 64px", marginBottom: "clamp(40px,5vw,64px)" }}>
                <div style={{ flex: "1 1 560px" }}>
                  <p className="kicker">How it works</p>
                  <h2 id="how-h" className="h2">
                    Four steps. You only do <span className="mk">the first.</span>
                  </h2>
                </div>
                <p className="lead" style={{ flex: "0 1 420px" }}>
                  After you list, our team and our system do the searching and messaging. You just answer the phone.
                </p>
              </div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
                {STEPS.map((s) => (
                  <li key={s.n} data-rv-group="how" className={`card lift rv ${s.d}`} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22, minHeight: 340 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-.06em", lineHeight: 0.8, color: "var(--m-str)" }}>{s.n}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: s.ink ? "var(--ink)" : "var(--m)", color: s.ink ? "var(--bg)" : "var(--on-m)" }}>{s.who}</span>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--m-soft)", color: "var(--m-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg className={`ico ${s.anim}`} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animationDelay: `${s.ad}ms` }}>
                        <path d={s.icon} />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.03em" }}>{s.title}</h3>
                      <p style={{ margin: "8px 0 0", fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)" }}>{s.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="sec" style={{ paddingTop: 0 }} aria-labelledby="lead-h">
            <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(40px,6vw,96px)", alignItems: "center" }}>
              <div data-rv="lead" data-rv-group="lead" className="rv" style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 22 }}>
                <p className="kicker">What you get</p>
                <h2 id="lead-h" className="h2" style={{ marginTop: 0 }}>
                  This is what <span className="mk">a lead</span> looks like.
                </h2>
                <p className="lead">A real person, their number, and exactly what they said. It shows up in your LEADS inbox and on your phone.</p>
                <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
                  {GET_LIST.map((g) => (
                    <li key={g} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 17, lineHeight: 1.5 }}>
                      <Check />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <PhoneMock />
            </div>
          </section>

          <section className="sec" style={{ paddingTop: 0 }} aria-labelledby="promise-h">
            <div className="wrap">
              <div data-rv="promise" data-rv-group="promise" className="rv" style={{ borderRadius: 32, background: "var(--panel)", color: "var(--on-panel)", border: "1px solid var(--line)", padding: "clamp(28px,5vw,72px)", display: "flex", flexWrap: "wrap", gap: "clamp(32px,5vw,72px)", alignItems: "center" }}>
                <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <p className="kicker" style={{ color: "var(--m)" }}>
                    Our promise
                  </p>
                  <h2 id="promise-h" className="h2" style={{ marginTop: 0 }}>
                    60 days. Or we pay you back.
                  </h2>
                  <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, opacity: 0.8, maxWidth: 520 }}>
                    Every package runs for 60 days. If we can&apos;t bring you all the buyers you paid for, you get money back for the ones we missed.
                  </p>
                </div>
                <PromiseSlider />
              </div>
            </div>
          </section>

          <section id="pricing" className="sec" style={{ paddingTop: 0 }} aria-labelledby="price-h">
            <div className="wrap">
              <div data-rv="price" data-rv-group="price" className="rv" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px 64px", marginBottom: "clamp(40px,5vw,56px)" }}>
                <div style={{ flex: "1 1 560px" }}>
                  <p className="kicker">Pricing</p>
                  <h2 id="price-h" className="h2">
                    Pay for buyers, <span className="mk">not for ads.</span>
                  </h2>
                </div>
                <p className="lead" style={{ flex: "0 1 420px" }}>
                  Pick how many leads you want. Listing your property is free.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, alignItems: "stretch" }}>
                {planList.map((pl, i) => {
                  const copy = PLAN_COPY[pl.name] ?? { for: `${pl.leadCount} leads`, feats: ["60-day delivery", "Money back for missed leads"], pop: false };
                  return (
                    <div key={pl.id} data-rv-group="price" className={`card lift rv ${i ? `d${i}` : ""} ${copy.pop ? "plan-pop" : ""}`} style={{ padding: 32, display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
                      {copy.pop && (
                        <span className="pop-b" style={{ position: "absolute", top: -14, left: 32, fontSize: 12.5, fontWeight: 800, padding: "6px 14px", borderRadius: 999, background: "var(--m)", color: "var(--on-m)" }}>
                          Most chosen
                        </span>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 20 }}>{pl.name}</div>
                        <div style={{ fontSize: 15, opacity: 0.7, marginTop: 2 }}>{copy.for}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 68, fontWeight: 900, letterSpacing: "-.06em", lineHeight: 1 }}>{pl.leadCount}</span>
                        <span style={{ opacity: 0.75 }}>leads</span>
                      </div>
                      <div className="mono" style={{ fontSize: 17 }}>
                        PKR {groupPk(pl.pricePkr)}
                      </div>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                        {copy.feats.map((f) => (
                          <li key={f} style={{ display: "flex", gap: 10, fontSize: 15, alignItems: "center" }}>
                            <Check dark />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link href={signedIn ? `/packages/buy?plan=${pl.id}` : `/signup`} className={`btn np ${copy.pop ? "b-m" : ""}`}>
                        Start with {pl.name}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="agencies" className="sec" style={{ paddingTop: 0 }} aria-labelledby="ag-h">
            <div className="wrap">
              <AgencyTabs />
            </div>
          </section>

          <section id="faq" className="sec" style={{ paddingTop: 0 }} aria-labelledby="faq-h">
            <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: "clamp(24px,5vw,80px)", alignItems: "flex-start" }}>
              <div data-rv="faq" data-rv-group="faq" className="rv" style={{ flex: "1 1 300px" }}>
                <p className="kicker">FAQ</p>
                <h2 id="faq-h" className="h2">
                  Questions sellers ask us.
                </h2>
              </div>
              <div style={{ flex: "999 1 560px", minWidth: 0 }}>
                {FAQS.map((f) => (
                  <details key={f.q}>
                    <summary>
                      {f.q}
                      <span className="pm" aria-hidden="true">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section style={{ padding: "0 0 clamp(64px,8vw,112px)" }} aria-labelledby="end-h">
            <div className="wrap">
              <div data-rv="end" data-rv-group="end" className="rv" style={{ background: "var(--m)", color: "var(--on-m)", borderRadius: 36, padding: "clamp(36px,6vw,88px)", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
                <div style={{ flex: "1 1 480px", position: "relative" }}>
                  <h2 id="end-h" className="h2" style={{ margin: 0 }}>
                    Your buyer might live one street away.
                  </h2>
                  <p style={{ margin: "16px 0 0", fontSize: 18, maxWidth: 520, opacity: 0.9 }}>List your property today. Listing is free. You only pay when you want buyers.</p>
                  <Link href={startHref} className="btn" style={{ marginTop: 30, background: "var(--surface)", color: "var(--ink)", borderColor: "var(--surface)" }}>
                    List your property
                    <span className="ar" style={{ background: "var(--m)", color: "var(--on-m)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </Link>
                </div>
                <div className="post" aria-hidden="true">
                  <span className="pole" />
                  <span className="arm" />
                  <div className="hang">
                    <span className="chain" style={{ left: 20 }} />
                    <span className="chain" style={{ right: 20 }} />
                    <div className="board">
                      <div className="flip">
                        <div className="face front">
                          <span className="eyes">
                            <i />
                            <i />
                          </span>
                          <span style={{ fontSize: 27, lineHeight: 1.1 }}>FOR SALE</span>
                          <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".02em", fontWeight: 600 }}>
                            10 Marla · G-13/2
                          </span>
                        </div>
                        <div className="face back">
                          <span style={{ fontSize: 38, lineHeight: 1 }}>SOLD!</span>
                          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0, marginTop: 6 }}>in 23 days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
