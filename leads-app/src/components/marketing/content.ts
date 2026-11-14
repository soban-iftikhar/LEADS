// Landing copy that is also published as structured data.

export const FAQS = [
  { q: "What exactly is a lead?", a: "A person who got our message about your property and replied that they are interested, or filled in the form we sent them. If they did not say yes, it is not a lead and you do not pay for it." },
  { q: "Will other sellers get the same buyer?", a: "No. Each lead is sold once, to you. We never sell it again." },
  { q: "What if you do not bring all my leads?", a: "Your package runs for 60 days. Whatever we could not deliver in that time comes back to you as money." },
  { q: "What if a lead is fake or useless?", a: "Report it from your inbox. If we agree, that lead goes back into your package." },
  { q: "Why do you check my listing first?", a: "People only reply to listings that look real. A complete listing with good photos gets you more yeses." },
  { q: "Which areas do you cover?", a: "Islamabad and Rawalpindi for now." },
];

const ORIGIN = process.env.APP_URL ?? "http://localhost:3000";

export function orgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LEADS",
    url: ORIGIN,
    logo: `${ORIGIN}/icon.svg`,
    areaServed: ["Islamabad", "Rawalpindi"],
    address: { "@type": "PostalAddress", addressLocality: "Islamabad", addressCountry: "PK" },
  };
}

export function serviceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Buyer leads for property sellers",
    serviceType: "Real estate lead generation",
    provider: { "@type": "Organization", name: "LEADS" },
    areaServed: [
      { "@type": "City", name: "Islamabad" },
      { "@type": "City", name: "Rawalpindi" },
    ],
    description: "We message people who might buy your house or plot and send you only the ones who reply yes. Undelivered leads are refunded after 60 days.",
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
