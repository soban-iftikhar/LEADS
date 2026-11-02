// Canned answers for Ghar until POST /api/assistant/chat exists (phase 2).
// TODO(api): replace answerFor() with a call to /api/assistant/chat { message, page }.

export type GharArea = "marketing" | "auth" | "app";

type Rule = [RegExp, string];

const TALK_TO_PERSON =
  "Sure. Our team is on WhatsApp from 9am to 9pm. I have flagged your chat, someone will message you.";

const RULES: Record<GharArea, Rule[]> = {
  marketing: [
    [/salam|^hi|hello|hey|aoa/, "Walaikum salam! Ask me about pricing, leads, or how we find buyers."],
    [/what is a lead|lead kya|^lead|leads\b.*mean/, 'A lead is a real person who got our WhatsApp about your property and replied "interested". No yes, no charge.'],
    [/price|cost|kitna|fee|pay|package|how much/, "Listing is free. You buy a package of leads: 25, 100 or 250 buyers. Prices are in the Pricing section."],
    [/60|money back|refund|cashback|miss|don.?t come|nahi/, "Every package runs 60 days. Any lead we miss comes back to you as money."],
    [/fake|bad|wrong|report|spam/, "Report it from your inbox. If we agree, that lead goes back into your package."],
    [/area|city|islamabad|rawalpindi|pindi|dha|bahria|g-1|b-17/, "Islamabad and Rawalpindi for now: G-13, B-17, DHA, Bahria Town and more."],
    [/human|person|call|whatsapp|team|talk|insaan/, TALK_TO_PERSON],
    [/agency|agent|many|multiple/, "Agencies get one account for all listings, and one inbox with every lead tagged by property."],
  ],
  auth: [
    [/salam|^hi|hello|hey|aoa/, "Walaikum salam! Ask me about logging in, codes, or account types."],
    [/forgot|reset|password|bhool/, 'Tap "Forgot password?" and we email you a link to set a new one.'],
    [/code|otp|didn.?t get|nahi aya|not received/, 'Codes come on WhatsApp within a minute. Check the number, then tap "Send a new code" after 30 seconds.'],
    [/owner|agency|which|type/, "Owner: you sell your own house or plot. Agency: you list many properties for clients. Pick one per account."],
    [/free|cost|price|pay/, "Creating an account and listing are free. You only pay for lead packages."],
    [/human|person|call|whatsapp|team|talk|insaan/, "Sure. Our team is on WhatsApp 9am to 9pm. I have flagged your chat."],
  ],
  app: [
    [/salam|^hi|hello|hey|aoa/, "Walaikum salam! Ask me about your leads, listings or package."],
    [/fake|bad|wrong|report|spam/, "Open the lead and tap Report within 7 days. If we agree, that lead goes back into your package."],
    [/arriv|when do leads|kab|start/, "Leads start arriving within 48 hours of your package starting. Each one shows up in Leads and on your WhatsApp."],
    [/60|money back|refund|cashback|miss|don.?t come|nahi/, "Every package runs 60 days. If it ends with fewer leads than you bought, we refund every missing lead at the price you paid."],
    [/human|person|call|whatsapp|team|talk|insaan/, TALK_TO_PERSON],
  ],
};

const FALLBACK: Record<GharArea, string> = {
  marketing: "Good question. I'll pass it to the team and they'll reply on WhatsApp. Meanwhile, try one of the buttons below.",
  auth: "Good question. I'll pass it to the team and they'll reply on WhatsApp.",
  app: "Good question. I'll pass it to the team and they'll reply on WhatsApp.",
};

export function answerFor(area: GharArea, question: string): string {
  const t = question.toLowerCase();
  for (const [re, a] of RULES[area]) if (re.test(t)) return a;
  return FALLBACK[area];
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
