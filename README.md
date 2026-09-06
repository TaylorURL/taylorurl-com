<p align="center">
  <img src="public/images/TaylorURL-Logo.png" width="200" alt="TaylorURL" />
</p>

<h1 align="center">TaylorURL</h1>

<p align="center">
  <b>Custom websites and JavaScript applications for local businesses.</b>
</p>
<p align="center">
  The studio site for TaylorURL LLC — a prerendered React marketing site.<br />
  Live at <a href="https://taylorurl.com">taylorurl.com</a>.
</p>
<p align="center">
  <sub>Published for reading. Proprietary — see <a href="LICENSE.md">LICENSE.md</a>. Outside contributions are not accepted.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2026.36.178-2f6bff?style=for-the-badge" alt="Version 2026.36.178" />
  <img src="https://img.shields.io/badge/React-19-2f6bff?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-7-2f6bff?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-2f6bff?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3" />
  <img src="https://img.shields.io/badge/Supabase-4f86ff?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Vercel-2f6bff?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

<br />

## Why TaylorURL

Most small-business sites are either a static template that never ranks or a single-page app that hands crawlers an empty shell. TaylorURL is the studio's own site built to do the opposite: every route is rendered to real static HTML at build time with per-page meta and JSON-LD, and analytics are first-party and cookieless — no third-party trackers, no cookie banner.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h3 align="center">Built to rank</h3>
      <p align="center">Every route is prerendered to static HTML at build time with per-page meta and JSON-LD, so crawlers get real SEO markup instead of an empty SPA shell.</p>
    </td>
    <td width="50%" valign="top">
      <h3 align="center">Cookieless analytics</h3>
      <p align="center">Pageviews are posted to a first-party analytics ingest function — no third-party trackers, and no cookie banner.</p>
    </td>
  </tr>
</table>

<br />

## Stack

| Layer                | Technology                                                                                      |
| :------------------- | :---------------------------------------------------------------------------------------------- |
| UI                   | React 19 + React Router 7                                                                       |
| Build & dev          | Vite 7 with custom prerender, sitemap, feed and llms.txt plugins                                |
| Styling              | Tailwind CSS 3, on the token block in `src/index.css`                                           |
| Animation            | Framer Motion 12                                                                                |
| Charts               | `recharts` — the traffic console                                                                |
| Icons                | `lucide-react`                                                                                  |
| WebGL effects        | `ogl` — particles, aurora backdrop                                                              |
| Backend              | Supabase Edge Functions + Postgres (email capture, analytics, error reporting)                  |
| Auth                 | Supabase Auth — accounts, with a role per profile                                               |
| Analytics            | First-party, cookieless                                                                         |
| Outbound mail        | Resend for enquiries, the newsletter and client notifications; Nodemailer and IMAP for outreach |
| SEO                  | `react-helmet-async` + build-time static prerender                                              |
| Serverless & hosting | Vercel Functions + Vercel                                                                       |

## Getting started

```bash
npm install
npm run dev           # Vite dev server
npm run build         # production build, then static prerender of every route
```

No environment configuration is required to run the site locally. The forms and the console's sign-in reach the backend with a publishable key, which row-level security scopes to what an anonymous reader may already see.

`lib/` is part of the browser build, not only the serverless runtime. The console's outreach section reads a prospect the same way the pipeline writes one, so `src/app/utils/outreachOpportunity.js` imports `lib/outreach/platforms.js` and the build fails there if that directory is missing. Anything that carves the tree up — a partial checkout, a deploy that ships only `src/`, a branch holding the console without the pipeline — has to carry `lib/` with it.

### Scripts

| Script                           | Does                                                                                                       |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Start the Vite dev server.                                                                                 |
| `npm run build`                  | Production build, then static prerender of every route.                                                    |
| `npm run capture:portfolio`      | Regenerate the portfolio preview images in `public/portfolio/`.                                            |
| `npm run audit:portfolio`        | Read every live site the portfolio names and report where the recorded copy no longer matches it.          |
| `npm run capture:review-logos`   | Regenerate the reviewer logos in `public/images/reviews/` from each client's own site.                     |
| `npm test`                       | Run the check suite.                                                                                       |
| `npm run refresh:db-constraints` | Take the schema's CHECK constraints again into `scripts/db-constraints.json`. Run it with every migration. |
| `npm run lint`                   | Lint with ESLint.                                                                                          |
| `npm run lint:fix`               | Lint and auto-fix.                                                                                         |
| `npm run format`                 | Format the repo with Prettier.                                                                             |
| `npm run format:check`           | Check formatting without writing.                                                                          |

## Architecture

```mermaid
flowchart TD
    V["Visitor"] --> Site["Marketing site: React + Vite, prerendered on Vercel"]
    Any["Every tracked site"] -->|"pageview, heartbeat, pageleave"| IN["Analytics ingest"]
    IN --> DB[("Postgres, RLS-locked")]
    Site -->|"Trustpilot rating"| TP["api/trustpilot.js"] --> TB["Trustpilot TrustBox data"]
    Site -->|"newsletter + email capture"| DB
    Site -->|"enquiry"| CT["api/contact.js"] --> RS["Resend"]
    Site -->|"uptime + incidents"| SF["api/status-feed.js"] --> MON["Uptime monitor"]
    Console["/console"] -->|"signed-in session"| AN["api/analytics.js"] --> DB
    Client["A client project's own deployment"] -->|"bearer secret per project"| NF["api/notify.js"] --> RS
```

## How it works

- **Prerendered for SEO.** The site is a React SPA that also renders every route to static HTML at build time. `vite/prerender-plugin.js` loads `src/entry-server.jsx` through Vite's SSR loader — no headless browser — and writes a real document per route, directory-style URLs plus a top-level `404.html`.
- **Real markup in the head.** React 19 hoists each page's `react-helmet-async` title, meta, canonical, Open Graph, and JSON-LD into the prerendered `<head>`, and `vite/sitemap-plugin.js`, `vite/feed-plugin.js` and `vite/llms-plugin.js` emit `sitemap.xml`, `feed.xml` and `llms.txt` from the same route table.
- **Targeted at local search.** Pages carry `geo.*` meta and a `LocalBusiness` / `ProfessionalService` schema for Baytown, TX and the greater Houston area. The work is carried out from Baytown and there is nowhere a visitor can be met, so the schema's address stops at the locality and `areaServed` carries the reach as a circle plus the markets the service pages name.
- **The console asks for a sign-in.** `/console/status` is the uptime monitor's board and is open to anyone; it reports on no account. Every other section verifies the session against the project, and the database functions decide what that account may read, so the page chooses what to show and never what it is allowed to fetch.
- **One tracker, every site.** The collector serves the browser tracker that every site TaylorURL runs includes with a single script tag, so a change to what gets collected is one deploy rather than a dozen releases. Hits carry no address and no cookie: the country comes from the browser's own timezone, the session and visitor ids are random numbers in the browser's storage, and the collector accepts a hit only from the origins its site is registered with.
- **Type is served from this origin.** Geist and Geist Mono are two variable woff2 files in `public/fonts/`, declared as `@font-face` in `src/index.css` and preloaded from `index.html`, so the first paint waits on nothing third-party.
- **Secrets stay on the server.** Newsletter subscribers and lead submissions are written to Postgres tables whose RLS is locked to the service role — the browser's publishable key can neither read nor write them.
- **Client projects send through this one.** Every product the studio runs eventually has to reach somebody with the site closed, and a sender per client would be a domain to warm and a reputation to earn per client. `api/notify.js` lends them this one: a project posts what happened with its own bearer secret, and the message is drawn on the same sheet in that project's name, colour and mark. The identity is a row rather than a branch — a project becomes able to send when one appears in `notify_projects` — and the row is found by the digest of the secret presented, so a deployment can only ever send as itself.

## The lead figure

Three surfaces take an enquiry, and all three post to `api/contact.js`: the contact page, the free tools, and the configurator. Each names itself in `form`, so `public.enquiry_attribution` answers which of the three produced a lead and which campaign it arrived on. That table is the lead figure. Nothing else on the site counts as one — a checkout that opens is a sale in Stripe, and a newsletter subscriber is a reader.

The configurator is the newest of the three and the reason the number moved. It asks five screens of questions and used to end at a card, so a visitor who answered four of them and stopped left nothing behind at all; `SaveSection` sends the configuration as it stands, and the pay step's second button carries the same answers to the contact form rather than dropping them.

**The table starts on 30 August 2026.** Enquiries before that were delivered and never filed, so there is no earlier figure to compare against and one cannot be reconstructed from anything the site holds — the record of them is the inbox. Read the number from that date forward and treat anything before it as unmeasured rather than as zero:

```sql
select date_trunc('week', created_at) as week, form, count(*)
from enquiry_attribution group by 1, 2 order by 1 desc;
```

Two things in `analytics_events` are not visitors, and a rate taken against the raw table rather than through the console will count both. Hits the collector marks `device_type = 'bot'` are one, and the console never sees them: `analytics_overview` and `analytics_site`, the two functions behind every figure it draws, already drop them. Hand-written SQL against the table does not, which is the only place that difference shows up.

The console itself is the other. It is the studio's own workspace, open all day, and it stood for over a third of everything recorded. The tracker now files nothing for it — no view, no dwell, no heartbeat, so it does not appear in the live view either. The rule is declared on the script tag in `index.html` rather than held in the collector, because one tracker serves every site TaylorURL runs and a private workspace on this one is an ordinary page on the next:

```html
data-ignore="/console,/login,!/console/status"
```

A path is ignored when it sits under an entry, unless it sits under one marked `!`, which counts it — the status board is open to anyone and the home page sends readers to it by name. A site that declares nothing ignores nothing.

The tag only governs what is collected from the deploy forward, and a 30-day window reaches back well before it. So the console reads the same rule a second time over the rows it draws: `src/app/views/analytics/lib/counted.js` takes those paths out of the pages table and the two rankings beside it, and `scripts/check-traffic-ignore.js` holds the two declarations to the same string. It applies to this site's rows and no others — one tracker serves every site under care, and `rootriseholdings.com/login` is a client's own sign-in page rather than a workspace. What it does not touch is the window's totals, which arrive already added up, so a pageview count taken before the deploy still carries the console inside it. The rows the collector sends are the fifty most read, and dropping some of them leaves fewer rather than reaching for the next few; both heal as the window rolls past 5 September 2026.

## Blog

Articles are data, not pages. Each one is an object in `src/app/data/blog/` carrying its title, category, date and body blocks, and everything downstream is derived from that list: the cards, the article route, the sitemap entry, the feed entry, the prerendered HTML, and the JSON-LD. Publishing is appending an object and one line naming its series.

Two axes cross over the same articles. A **category** — one of five — says what an article is about and drives the filter row. A **series** — one of six, defined in `src/app/data/blog/series.js` — says which running body of work it belongs to, gets its own page at `/blog/series/<slug>`, and is what a reader follows from one article to the next three. An article belongs to exactly one series; a series with nothing in it yet is defined in the register but appears nowhere on the site. Every article page carries a share row and the accounts the business posts from, both plain links, so no network's script loads on a reader who only scrolled past.

## Notifications for client projects

`api/notify.js` is the one door a client project's own deployment knocks on to reach a person. It posts what happened; the studio's mail stack delivers it as an email drawn in that project's name, colour and mark. Nothing in the endpoint knows what any one client is: a project becomes able to send when a row appears in `notify_projects`, and stops when that row's `active` goes false.

### How a project authenticates

A project holds one secret and names itself on every call.

```
Authorization: Bearer <the project's own secret>
X-Notify-Project: <slug>
```

The row is found by the SHA-256 of the secret presented, never by the slug, so there is no field a caller controls that names a project its credential does not resolve to. `X-Notify-Project` is then read against the row that came back, which is what tells a deployment holding the wrong secret on its first call rather than on the day somebody notices the wrong logo. A missing token, an unknown one, and a real one naming somebody else's project are refused in the same sentence, because three different ones would let anybody with an HTTP client learn which projects exist. `CRON_SECRET` is the one token on which the header selects a project instead of confirming one.

The secret in plain text exists only on the client's own deployment. This side holds its digest, so a service-role read of the table — which the mail console performs — hands out nobody's sending credential.

### The request

`POST https://www.taylorurl.com/api/notify`, `Content-Type: application/json`, at most 16 KB.

| Field             | Shape                                          | What it does                                                    |
| :---------------- | :--------------------------------------------- | :-------------------------------------------------------------- |
| `subject`         | string, required, cut to 140                   | The subject line, and the heading inside the message            |
| `severity`        | `info`, `warning` or `urgent`, default `info`  | Who is reached, and whether the message is marked urgent        |
| `lines`           | up to 16 `[label, value]` pairs                | The facts, set in two columns                                   |
| `body`            | string up to 4000, newlines kept               | What the notification carries in its own words                  |
| `link`            | `{ label, url }`, `https:` only                | The one thing the reader is asked to open                       |
| `idempotency_key` | `[A-Za-z0-9:_.-]{1,200}`, default a random one | What makes a retry of a post whose answer was lost send nothing |

At least one of `lines` or `body` has to be there. Unknown fields are ignored, so a caller can start sending a field before this endpoint has learned it. A value longer than its cap is cut rather than refused; the request itself is refused, because a body this endpoint has to parse before it can measure is worth a ceiling.

`GET` on the same URL, with the same two headers, answers the project's own record — its name, sending address, accent, how many seats it has, and what the day's ceiling has counted — and mails nobody. It is how a deployment proves its credential without waking anyone, and it carries counts rather than addresses.

### The answers

| Status | Body                                                                  | What the caller does                                                                        |
| :----- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| `200`  | `{ id, project, severity, recipients, delivered, failed, duplicate }` | Reached `delivered` of `recipients`. Anything under is worth a log line                     |
| `200`  | the same, plus `reason`, with `delivered: 0`                          | Nobody takes a notification at that level. Log it as a failure, and post the same key again |
| `200`  | `{ id, project, delivered: 0, duplicate: true }`                      | This key has reached somebody already. Nothing to do                                        |
| `400`  | `{ error }`                                                           | The body is wrong. Fix the caller; retrying will not help                                   |
| `401`  | `{ error: "not authorized" }`                                         | The credential or the slug is wrong                                                         |
| `403`  | `{ error }`                                                           | The project is not sending right now                                                        |
| `413`  | `{ error }`                                                           | Over 16 KB                                                                                  |
| `429`  | `{ error }`, with `Retry-After`                                       | Wait the seconds named and post the same key again                                          |
| `502`  | `{ error }`                                                           | Nothing was delivered. Post the same key again                                              |
| `503`  | `{ error }`                                                           | The deployment is not set up to send. Post the same key again later                         |

A notification is claimed in `notify_deliveries` before anything reaches the transport, so the same `idempotency_key` posted twice reaches somebody once — which matters because the callers are schedules, and a sweep that cannot tell whether its notification landed will post it again. A claim that failed is owed and is picked up by the next post of that key; so is one a run died holding.

Only a delivery stamps a row sent, and that is what makes `duplicate: true` safe to read as _delivered_ rather than merely as _claimed_. A send that reached nobody is stamped failed, exactly like one the provider refused, so its key stays retakeable and every later post of it is answered with the same `reason` rather than with a `duplicate` the caller would record as told.

The one answer worth reading carefully is a `200` carrying a `reason`. A project whose whole list is paused, suppressed or standing above the severity reached nobody and did not fail, and a caller that treats it as a success is back to the alert that never arrived and never errored. It is worth posting again on the next pass: the recipient list is read fresh every time, so the seat being added, un-paused, lowered to this severity or lifted off the suppression list is what turns the next post into a delivery.

### How a project is branded

Everything a reader sees comes off the project's own row. `name` and `mark_url` draw the masthead, with `mark_ground` saying whether the artwork survives the black slab or needs the pale one; `accent` colours the eyebrow rule and the button; `site_url` is set beside the mark as the domain the message is about; `link_label` is what an unlabelled link is called; `footer_line` signs it off. `from_name` and `from_address` are the sending identity, and `reply_to` is where an answer written from the message goes.

The address has to be on a domain Resend has verified against the studio's account, which is `notifications@taylorurl.com` until a client verifies their own. Moving a project to its own address afterwards is one column changing and nothing else.

There is no template per project. A notification is a heading, a short reading of facts and one thing to open, and a project that needs its own layout needs its own product rather than a branch in this one. `lib/mail/catalogue.js` draws the family from a sample, so what a client's message looks like can be read in the mail console beside everything else the studio sends.

### Adding the next project

1. Mint the secret — `openssl rand -hex 32` — and store it in the vault. It is never written into `notify_projects`.
2. Insert the project row with `secret_sha256` set to the SHA-256 hex of that secret, and its name, accent, mark and footer. Set `link_label` too: an unlabelled link falls back to the project's own name, so the button on every message reads as the client's brand rather than as what pressing it does.
3. Set `burst_limit` against the caller's cadence rather than taking the default. The window is ten minutes wide, so a project posting from a cron works out at (posts per pass) × (passes per ten minutes), and the ceiling wants headroom above that — a caller sending up to four an invocation on a two-minute schedule reaches twenty, and a limit under it refuses real traffic on the first busy morning.
4. Insert a row in `notify_recipients` per person, each with the quietest severity they want to be woken for. The suppression list is checked over the top of that, so an address that has unsubscribed or hard bounced is reached by nothing. Seed this before the secret reaches the client's deployment: a project with no seats yet answers every post with a reason and reaches nobody, which is honest but is not a notification.
5. Put the secret on the client's deployment and have it post as above.
6. Optionally verify the client's domain in Resend and move `from_address` onto it.

The row is the whole of it. Nothing about a new project is a release on this side.

## Project structure

```
taylorurl-com/
├── api/                       Vercel serverless functions — the enquiry form, checkout and the Stripe webhook, the live chat, the ratings and status proxies, the analytics and console reads, the mailing list, the notifications door client projects send their own alerts through, the outreach and social pipelines on their schedules, and the public speed check and site audit
├── brand/                     The social post generator and the faces it draws with
├── lib/                       Shared by the functions under api/ and by the console bundle
│   ├── db/                    Paged reads, the two Supabase clients and the door in front of them, and the shapes a value takes before it reaches a column
│   ├── http/                  Request guards, the timed fetch, the scheduler check, and the console's edge proxy
│   ├── live-chat/             How much of the assistant one connection gets, and what a typed message is read for before a turn is spent
│   ├── mail/                  The mailing list's audience, issues, catalogue, bodies and identity, and the brand a message sent for a client project is drawn in
│   ├── outreach/              The pipeline's rules, limits, message and address checks
│   │   └── openers/           The letters the sender can open with, one file each, listed by the registry beside them
│   ├── social/                The social queue, its watch and the announcement
│   ├── speed-check/           How a public speed reading is worded
│   └── time/                  The zone every time in this project is read in
├── public/                    Static assets — logo, the two share cards, portfolio shots, robots.txt, the Geist woff2 files
├── scripts/                   The check suite `npm test` runs, plus the capture, audit and regeneration tools
├── vite/                      Build plugins (prerender, sitemap, feed, llms.txt, review schema, head order, inline script, site head, site static) + shared route table
├── .github/workflows/         CI (the required `check` context), the attribution gate, and the portfolio captures
├── src/
│   ├── app/
│   │   ├── components/        Layout, Navigation, mockups, Seo
│   │   │   └── reactbits/     WebGL + motion effects (Aurora, Particles, ShinyText…)
│   │   ├── views/             Route views (Home, Services, Portfolio, Blog, Console…)
│   │   │   ├── analytics/     Charts, and the number formatting under lib/
│   │   │   ├── console/       Console shell: sidebar, pages, and the section catalogue, tokens and shortcuts under lib/
│   │   │   ├── status/        The uptime board, the console's public section
│   │   │   ├── home/          The home page's sections, its chart, and the four hero presentations
│   │   │   ├── start/         The configurator's steps, and the ground and look questions under lib/
│   │   │   ├── tools/         The public tools: the Google presence check, logo cleaner and QR generator
│   │   │   ├── services/      The blocks a service page is built from
│   │   │   ├── notes/         The newsletter archive's artwork, body renderer, and date formats
│   │   │   ├── subscription/  The frame the confirm and unsubscribe pages report into
│   │   │   └── auth/          Shared shell and field for Log In, Sign Up, and the password reset pages
│   │   ├── hooks/             session, two-factor, theme, analytics feed, toast, blog filters, scroll
│   │   ├── constants/         navigation, seo, animations, grounds, mesh, routes
│   │   ├── data/              blog articles, portfolio, trades and tools, pricing, reviews, newsletter issues
│   │   ├── tools/             QR encoding and drawing, the logo cutout, the zip, and how a site reading is worded
│   │   └── utils/             blog-HTML sanitization (DOMPurify), validation, domain formatting, retrying lazy imports, the newsletter's email template, how a prospect's audit score reads
│   ├── entry-server.jsx       Prerender entry (react-dom/server)
│   └── main.jsx               Browser entry
└── vercel.json                Security headers + caching
```

Vite writes a content hash into every filename under `/assets`, so one of those files cannot change without changing its name. `vercel.json` serves them `immutable` for a year on that basis; the documents themselves stay on `must-revalidate`, so a deploy is live on the next request.

## License

Copyright (c) 2026 TaylorURL LLC. All rights reserved. See [LICENSE.md](LICENSE.md).

<br />

<p align="center">
  <sub>Custom sites for local businesses — built to rank, wired to convert.</sub>
</p>
