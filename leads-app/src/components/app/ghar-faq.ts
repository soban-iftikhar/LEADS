// Ghar, the help bubble: answers common questions from these rules, on the device. It never
// claims to forward a chat: there is no inbox behind it. The AI assistant (phase 2) replaces
// answerFor() with a call to the backend.

export type GharArea = "marketing" | "auth" | "app";

type Rule = [RegExp, string];

const TALK_TO_PERSON = "Our team answers on WhatsApp from 9am to 9pm. Message the LEADS number you got your code or leads from, and a person will reply.";
const CITY_RULE = /area|city|islamabad|rawalpindi|pindi|dha|bahria|g-1|b-17/;

const RULES: Record<GharArea, Rule[]> = {
  marketing: [
    [/salam|^hi|hello|hey|aoa/, "Walaikum salam! Ask me about pricing, leads, or how we find buyers."],
    [/what is a lead|lead kya|^lead|leads\b.*mean/, 'A lead is a real person who got our WhatsApp about your property and replied "interested". No yes, no charge.'],
    [/price|cost|kitna|fee|pay|package|how much/, "Listing is free. You buy a package of leads: 25, 100 or 250 buyers. Prices are in the Pricing section."],
    [/60|money back|refund|cashback|miss|don.?t come|nahi/, "Every package runs 60 days. Any lead we miss comes back to you as money."],
    [/fake|bad|wrong|report|spam/, "Report it from your inbox. If we agree, that lead goes back into your package."],
    [/human|person|call|whatsapp|team|talk|insaan/, TALK_TO_PERSON],
    [/agency|agent|many|multiple/, "Agencies get one account for all listings, and one inbox with every lead tagged by property."],
  ],
  auth: [
    [/salam|^hi|hello|hey|aoa/, "Walaikum salam! Ask me about logging in, codes, or account types."],
    [/forgot|reset|password|bhool/, 'Tap "Forgot password?" and we email you a link to set a new one.'],
    [/code|otp|didn.?t get|nahi aya|not received/, 'Email codes arrive within a minute; check spam too. WhatsApp codes come to the number you typed. Tap "Send a new code" after 30 seconds.'],
    [/google/, "Tap Continue with Google on the login or sign-up page. First time, you pick Owner or Agency and you're in."],
    [/owner|agency|which|type/, "Owner: you sell your own house or plot. Agency: you list many properties for clients. Pick one per account."],
    [/free|cost|price|pay/, "Creating an account and listing are free. You only pay for lead packages."],
    [/human|person|call|whatsapp|team|talk|insaan/, TALK_TO_PERSON],
  ],
  app: [
    [/salam|^hi|hello|hey|aoa/, "Walaikum salam! Ask me about your leads, listings or package."],
    [/fake|bad|wrong|report|spam/, "Open the lead and tap Report within 7 days. If we agree, that lead goes back into your package."],
    [/arriv|when do leads|kab|start/, "Leads start arriving within 48 hours of your package starting. Each one shows up in Leads and on your WhatsApp."],
    [/60|money back|refund|cashback|miss|don.?t come|nahi/, "Every package runs 60 days. If it ends with fewer leads than you bought, we refund every missing lead at the price you paid."],
    [/human|person|call|whatsapp|team|talk|insaan/, TALK_TO_PERSON],
  ],
};

const FALLBACK = "I don't know that one yet. Try one of the buttons below, or ask our team on WhatsApp (9am to 9pm).";

/** `cities`: the active cities from config, for "which areas do you cover?" */
export function answerFor(area: GharArea, question: string, cities: string[] = []): string {
  const t = question.toLowerCase();
  if (area === "marketing" && CITY_RULE.test(t)) return cities.length ? `We work in ${cities.join(" and ")} for now.` : "Our cities are listed on the home page.";
  for (const [re, a] of RULES[area]) if (re.test(t)) return a;
  return FALLBACK;
}

export const QUICK_CHIPS: Record<GharArea, string[]> = {
  marketing: ["What is a lead?", "How much?", "What if leads don't come?", "Talk to a person"],
  auth: ["Forgot password", "Didn't get the code", "Owner or agency?", "Talk to a person"],
  app: ["How do I report a lead?", "When do leads arrive?", "How does cashback work?", "Talk to a person"],
};

export const GREETINGS: Record<
  GharArea,
  { hello: string; placeholder: string; bubble: { text: string; ms: number; delay: number } | null }
> = {
  marketing: {
    hello: "Salam! I'm Ghar. Ask me anything about selling with LEADS.",
    placeholder: "Ask about selling…",
    bubble: { text: "Salam! Selling a property? I can help.", ms: 6000, delay: 2600 },
  },
  auth: {
    hello: "Salam! I'm Ghar. Stuck anywhere? Ask me.",
    placeholder: "Ask me anything…",
    bubble: { text: "Need a hand? Tap me.", ms: 4500, delay: 2200 },
  },
  // app screens stay calm: no unprompted bubble
  app: { hello: "Salam! I'm Ghar. Ask me about your leads, listings or package.", placeholder: "Ask me anything…", bubble: null },
};
