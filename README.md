# LEADS
### Lead Extraction and Automated Distribution System

An AI-powered real estate lead generation platform built for the Pakistani
property market.

---

## What is LEADS?

Pakistan's real estate listings are scattered across half a dozen websites,
almost never complete, and full of ambiguity. A listing might say "5 Marla
house for sale" with no price, no room count, no documents, and no way to
tell if it's even still available. Buyers waste hours chasing sellers for
basic details. Sellers get lowball offers from people who never had a
realistic budget for the property in the first place.

LEADS exists to close that gap. It watches multiple property platforms at
once, figures out which kind of property is currently in real demand,
approaches sellers directly to get their listing properly documented and
verified, and then actively goes and finds the right buyers for it —
instead of just posting a listing and hoping the right person happens to
scroll past it.

In short: LEADS doesn't just list properties. It actively works each one —
finding it, verifying it, presenting it well, and matching it to real,
active buyers.

---

## The Problem, In Plain Terms

Three things repeatedly go wrong in the current market that LEADS is built
to fix:

- **Incomplete listings.** A seller posts "house for sale, ask for price"
  with nothing else. Buyers and agents are stuck messaging back and forth
  one question at a time — how many rooms, is gas available, what's the
  real price — which wastes enormous amounts of time on both sides.
- **Mismatched expectations.** A buyer sees a listing, assumes a rough
  price based on what's visible, then discovers on contact that the real
  price is three times what they expected. Nobody's time gets respected in
  that exchange.
- **No real matchmaking.** Listings sit passively waiting to be found.
  There's no system actively identifying who out there is a realistic
  buyer for a specific property and reaching out to them directly.

---

## How LEADS Works

At a high level, here's the journey a single property takes through the
system, from first discovery to a completed match:

**1. Spotting opportunity.** LEADS continuously scrapes multiple property
platforms and identifies which category of property — in which city, in
which price range — is currently showing real buyer demand, rather than
just guessing. A short, reviewable batch of listings in that category gets
surfaced.

**2. Reaching out to the seller.** From that batch, LEADS contacts the
seller directly over WhatsApp. If they respond, that seller becomes a
represented customer of the platform.

**3. Getting the full picture.** The seller is sent a structured
consent form — asking for exactly the details a serious buyer would want
to know (rooms, condition, documents, and more, tailored to the property
type) — along with LEADS' terms, so both sides know exactly what they're
agreeing to before anything else happens.

**4. Making the listing shine.** Once the seller submits their information,
LEADS uses AI to turn it into a polished, complete, well-presented listing
— pulling out the property's real selling points instead of leaving it as
a bare fact sheet. That listing goes live on LEADS' own buyer-facing
platform.

**5. Finding the right buyers.** The same submitted details tell LEADS
exactly what a realistic buyer for this property looks like — same
category, same price range. LEADS runs a targeted search across the other
platforms for people who are *themselves* trying to sell something
comparable, on the theory that someone selling a flat is a realistic buyer
for another flat in the same range.

**6. Making the connection.** Those prospective buyers get a WhatsApp
message with a direct link to the seller's newly listed property — and
LEADS tracks exactly how that outreach performs: how many messages were
sent, delivered, seen, or failed.

---

## Two Different Kinds of People LEADS Talks To

It's worth being explicit about this because it shapes a lot of how the
system behaves: LEADS deals with two entirely different relationships,
not one.

- **The Customer** — the seller whose property LEADS is actively
  representing. This relationship is consent-based: they've agreed to
  LEADS' terms, provided verified details, and LEADS earns a commission on
  a successful deal.
- **The Buyer Lead** — someone identified elsewhere on the market as a
  realistic buyer for the Customer's property. There's no ongoing
  relationship here — just a single, relevant outreach message pointing
  them to a listing they're likely to actually be interested in.

---

## Key Features

- **Multi-platform scraping** across Zameen.com, OLX Pakistan, Graana.com,
  and Ilaan.com, with the ability to search broadly or target an exact
  city, category, and price range
- **AI-assisted market awareness** — surfacing which property categories
  are currently in genuine demand, rather than just showing whatever's
  newest
- **Structured, consent-based data collection** directly from property
  owners, with terms and commission details made clear up front
- **AI-enhanced listing presentation** — turning a bare set of facts into
  a listing that actually reads well
- **Automated, targeted buyer outreach** over WhatsApp, with a live
  dashboard tracking delivery and read status for every campaign
- **A buyer-facing marketplace**, built in-house, for browsing verified,
  LEADS-represented listings

---

## Technology

- **Application:** Next.js
- **Database:** PostgreSQL, managed with Prisma
- **Caching / background jobs:** Redis
- **Scraping:** Python, Scrapy, and Playwright, run as a dedicated service
- **Messaging:** Meta's WhatsApp Cloud API
