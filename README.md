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
  <img src="https://img.shields.io/badge/version-5.2.61-2563eb?style=for-the-badge" alt="Version 5.2.61" />
  <img src="https://img.shields.io/badge/React-19-2563eb?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-7-2563eb?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 7" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-2563eb?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 3" />
  <img src="https://img.shields.io/badge/Supabase-3b82f6?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Vercel-2563eb?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
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
      <p align="center">Pageviews beacon to a first-party analytics ingest function — no third-party trackers, and no cookie banner.</p>
    </td>
  </tr>
</table>

<br />

## Stack

| Layer | Technology |
| :--- | :--- |
| UI | React 19 + React Router 7 |
| Build & dev | Vite 7 with custom prerender + sitemap plugins |
| Styling | Tailwind CSS 3 + `tailwindcss-animate` |
| Animation | Framer Motion 12 |
| Icons | `lucide-react` |
| Backend | Supabase (Postgres + Edge Functions) |
| Analytics | First-party, cookieless |
| SEO | `react-helmet-async` + build-time static prerender |
| Serverless & hosting | Vercel Functions + Vercel |

## Getting started

```bash
npm install
npm run dev           # Vite dev server
npm run build         # production build, then static prerender of every route
```

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — the newsletter and email capture call Supabase. The app renders without them, but those features stay inert.

### Scripts

| Script | Does |
| :--- | :--- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Production build, then static prerender of every route. |
| `npm run lint` | Lint with ESLint. |
| `npm run lint:fix` | Lint and auto-fix. |
| `npm run format` | Format `src/**` with Prettier. |
| `npm run format:check` | Check formatting without writing. |

## Architecture

```mermaid
flowchart TD
    V["Visitor"] --> Site["Marketing site: React + Vite, prerendered on Vercel"]
    Site -->|"pageview beacon"| SA["Analytics ingest"]
    Site -->|"Trustpilot rating"| TP["api/trustpilot.js serverless fn"]
    Site -->|"newsletter + email capture"| DB[("Supabase Postgres, RLS-locked")]
```

## How it works

- **Prerendered for SEO.** The site is a React SPA that also renders every route to static HTML at build time. `vite/prerender-plugin.js` loads `src/entry-server.jsx` through Vite's SSR loader — no headless browser — and writes a real document per route, directory-style URLs plus a top-level `404.html`.
- **Real markup in the head.** React 19 hoists each page's `react-helmet-async` title, meta, canonical, Open Graph, and JSON-LD into the prerendered `<head>`, and `vite/sitemap-plugin.js` emits `sitemap.xml` from the same route table.
- **Targeted at local search.** Pages carry `geo.*` meta and a `LocalBusiness` / `ProfessionalService` schema for Baytown, TX and the greater Houston area.
- **Secrets stay on the server.** Newsletter subscribers and lead submissions are written to Postgres tables whose RLS is locked to the service role — the browser's anon key can neither read nor write them.

## Project structure

```
taylorurl-com/
├── api/                       Vercel serverless functions (Trustpilot rating fetch)
├── onboarding/                Standalone HTML client-onboarding guides
├── public/                    Static assets — logo, portfolio shots, robots.txt
├── supabase/                  config.toml for analytics + error-reporting edge functions
├── vite/                      Build plugins (prerender, sitemap) + shared route table
├── src/
│   ├── app/
│   │   ├── components/        Layout, Navigation, mockups, Seo
│   │   ├── views/             Route views (Home, Services, Portfolio, Blog, Status…)
│   │   ├── hooks/             auth, toast, blog filters, scroll/parallax
│   │   ├── constants/         navigation, seo, animations, ui
│   │   ├── data/              blog articles, portfolio, home copy, supabaseClient
│   │   └── utils/             blog-HTML sanitization (DOMPurify), validation
│   ├── entry-server.jsx       Prerender entry (react-dom/server)
│   └── main.jsx               Browser entry
└── vercel.json                Security headers + caching
```

## License

Copyright (c) 2026 Trenton Taylor. All rights reserved. See [LICENSE.md](LICENSE.md).

<br />

<p align="center">
  <sub>Custom sites for local businesses — built to rank, wired to convert.</sub>
</p>
