// Baked knowledge snapshot for the live-chat assistant.
//
// Sourced from the live site as of build time. When the site copy on About,
// Services, Process, FAQ, or Contact changes meaningfully, refresh the strings
// below and re-deploy the function. There is no live scraping; everything the
// assistant knows lives here.
//
// Rule: keep it factual. Do NOT add prices, dates, or commitments the site
// itself doesn't state. The system prompt forbids the assistant from inventing
// those — keeping them out of this document is the safest guarantee.

export const KNOWLEDGE = `
# TaylorURL — what the assistant knows about the business

## Who runs it
- TaylorURL LLC is a one-person web-development studio. The owner and only
  builder is Trenton Taylor.
- Based in Baytown, Texas. Works with local small businesses across the
  Houston area — Baytown, Highlands, Mont Belvieu, Channelview, Crosby,
  La Porte, Deer Park, Pasadena, East Houston, and Houston itself. Will also
  work with local businesses anywhere; the whole project happens by phone,
  text, and email — no in-person meetings required.
- Clients deal with Trenton directly. No account managers, no support tickets,
  no layers between owner and builder. Replies same day on most messages,
  within 24 hours at the latest.

## What he builds
1. Brand-new websites — designed from scratch around the business and the
   customers it's trying to reach. No off-the-shelf templates.
2. Redesigns — full rebuilds of dated or underperforming sites. Looks, speed,
   structure, and how Google sees it, all redone.
3. Online tools — booking, ordering, customer logins, quote forms, simple
   dashboards. Custom-built to fit how the business actually runs, and tied
   into the apps they already use.
4. Hosting & ongoing care after launch — keeps the site online, fast, safe,
   and backed up. Security patches, daily backups, content updates, monitoring.

## Standard inclusions on every site
- Custom website design (not a template)
- Mobile-friendly across phones, tablets, and computers
- Hosting taken care of for them
- Regular updates, fixes, and 24/7 monitoring
- Quick page loads (target ~97+ PageSpeed)
- Daily backups
- Content updates
- A real person (Trenton) to call

## Stack & approach
- Custom-built. No WordPress, Wix, Squarespace, or drag-and-drop builders.
  Result: faster, safer, and not tied to a subscription that's hard to leave.
- Sites are designed mobile-first, optimised for speed and local SEO out of
  the gate, and built to be easy for Google to crawl.
- Some sites ship with a simple editor so the owner can change text and
  photos themselves; for others, Trenton handles updates directly — usually
  same-day. Either way is fine.

## Timeline
- Typical builds are live in 2–4 weeks.
- The published process: first call → plan & price → design → build →
  review → launch → ongoing care.
- Most messages get a reply same day; the outside reply window is 24 hours.

## Pricing
- Pricing is custom per project. Trenton quotes after a quick first call so
  he can scope it honestly.
- He does NOT publish prices, hourly rates, or starting-from numbers, and
  does NOT make up project prices over chat. Always: "we'll talk through it
  on a quick call."
- No annual contracts. Ongoing care plans can be cancelled at any time.
- If a client ever leaves, the whole site is handed over — they own it,
  there is no lock-in.

## Ownership & lock-in
- Clients own their site. If they ever move on, everything is handed over.
  No proprietary platform, no monthly fees that can't be cancelled.

## Process — what each step looks like (from the live "Process" page)
1. First call (day 1) — owner tells Trenton about the business and what they
   want; Trenton asks questions and gives an honest yes/no on fit.
2. Plan & price (day 2–3) — written plan covers what's built, what's
   included, the timeline, and the price.
3. Design (week 1) — Trenton designs each page; owner gives feedback until
   it feels right.
4. Build (week 2–3) — custom-built from the ground up; preview links shared
   the whole way.
5. Review & launch (week 3–4) — owner clicks through everything, Trenton
   fixes whatever needs fixing, then puts it live.
6. After launch (ongoing) — hosting, backups, security, content updates,
   small changes — included in the ongoing care plan.

## What Trenton needs from the client
- Logo (any file type) — or he can point them to someone who makes one.
- A clear sense of what each page should say (he handles polishing the copy).
- Photos of the work or the shop.
- Brand colours if they have them.
- Their web address, or help picking one.

## FAQ — the most common questions, plain answers
- "Who do you build for?" — Local businesses: shops, restaurants, trades,
  contractors, salons, dentists, realtors, law firms, and independent pros.
- "How long?" — 2–4 weeks for most builds.
- "Can you redesign an existing site?" — Yes. Full redesigns are routine.
- "Do you use WordPress / Wix / Squarespace?" — No. Custom-built only.
- "What's in ongoing care?" — Hosting, security, speed, backups, monitoring,
  fixes, and small content changes.
- "How is this different from an agency?" — One person, no support tickets,
  no account managers, direct line to the builder.
- "Can you build more than a basic site?" — Yes. Online booking, customer
  accounts, ordering, quote forms, and back-office tools are all in scope.
- "Do I own the site?" — Yes, completely. No lock-in.
- "Can I update content myself?" — Depends on the build. Either a simple
  editor is included, or you send Trenton a quick request and it's live
  the same day.
- "Houston area only?" — Mainly, but he works with local businesses anywhere
  since the whole project runs by phone/text/email.
- "What if I want to cancel?" — Any time. No annual contracts.

## How to get in touch
- Email: trenton@taylorurl.com — replies inside 24 hours.
- Contact form: /contact on the site.
- For visitors who are ready to move forward, the assistant should offer to
  capture their name, email, and a one-line project description through the
  built-in capture_lead tool, so Trenton can reach out personally.

## Blog — kinds of things Trenton writes about
- Local SEO and Google Business Profile basics.
- Site speed and image optimisation.
- Why custom sites beat WordPress/Wix/Squarespace for small businesses.
- How to pick a web developer without getting burned.
- What "mobile-first" actually means, and why it matters.
- Practical conversion tips — homepages, contact forms, copy.
The blog is for owners — practical, plain-English, no jargon. The assistant
can mention it exists ("/blog") but should NOT invent article titles.
`.trim()
