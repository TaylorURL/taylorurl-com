<p align="center"><img src="public/images/logo.png" alt="TaylorURL Logo" width="140" /></p>

<h1 align="center">TaylorURL</h1>

<p align="center"><strong>Web Development Agency & Client Portal for Southeast Texas Businesses</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/v4.3-release-1e3a5f" alt="Version 4.3" />
  <img src="https://img.shields.io/badge/React-19.1-61DAFB?logo=react&logoColor=white" alt="React 19.1" />
  <img src="https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite&logoColor=white" alt="Vite 7.1" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white" alt="Tailwind 3.4" />
  <img src="https://img.shields.io/badge/Framer_Motion-12-FF0055?logo=framer&logoColor=white" alt="Framer Motion 12" />
</p>

---

TaylorURL is a professional web development agency platform built by Trenton Taylor, based in Baytown, Texas. It operates as two interconnected products within a single application: a high-conversion marketing site aimed at Southeast Texas businesses seeking modern web presence, and a fully authenticated client portal where customers monitor the real-time health, analytics, and performance of their live websites.

The platform is designed to close the gap between selling a service and delivering ongoing value. Rather than pointing clients to third-party dashboards or sending manual reports, TaylorURL gives each customer a dedicated, branded window into their own site's data — visitor counts, page views, uptime percentage, and status badges — all surfaced through a clean portal that reinforces trust long after the initial project ships.

---

## Animated Landing Experience

The home page is a nine-section, full-viewport experience built to make an immediate impression. Each section transitions via scroll-triggered animations powered by Framer Motion 12, with an `IntersectionObserver`-driven dot navigation indicator (`SectionIndicator`) that tracks the viewer's position and allows instant section jumping. A `ScrollProgress` bar renders across the top of the viewport, giving users a subtle spatial anchor as they move through the page.

The centerpiece is a `MockupCarousel` — a 3D orbital display that cycles between browser, analytics, and code mockup variants, each animated independently with depth and rotation to simulate a live product showcase. Surrounding it, a `LogoMarquee` continuously scrolls client or technology logos, a `TypingRotator` cycles through headline variations to reinforce the service offering, a `CursorGlow` effect follows the pointer with a soft ambient light, and a `SocialProofCounter` animates numeric stats upward from zero as they enter the viewport.

## SEO & Local Search Presence

TaylorURL is built with search visibility as a first-class concern. Every page is wrapped in `react-helmet-async`, which injects per-route title tags, meta descriptions, Open Graph cards, and Twitter card metadata. The home page includes three structured data schemas injected as JSON-LD: `LocalBusiness`, `WebSite`, and a `WebPage` entity — all formatted to maximize eligibility for Google rich results and local pack inclusion.

Geographic targeting is explicit: the site declares `geo.region`, `geo.placename`, and `geo.position` meta tags pointing to Baytown, Texas, and the service area data covers 17 distinct Texas cities across Southeast Texas. The blog routes inject `BlogPosting` JSON-LD per article, and the FAQ page injects `FAQPage` JSON-LD to surface answer snippets directly in search results. A `robots.txt` and `sitemap.xml` are served statically from the public directory.

## Authentication & Role System

Authentication is handled entirely through Supabase Auth, supporting email/password sign-in, sign-up, and password reset flows. When a new user registers, a Postgres trigger automatically creates a corresponding row in the `profiles` table, pre-seeding their role as `client`. The system defines three distinct roles — `client`, `staff`, and `admin` — each of which resolves to a different application surface after sign-in.

Route protection is applied at the React Router level: unauthenticated users are redirected to the auth page, and role mismatches redirect to the appropriate fallback. The role is read from the `profiles` table via a custom hook that fires once on session load and is held in context for the lifetime of the session.

## Client Dashboard

Authenticated clients land in a personal dashboard that surfaces the health and performance of every website they own. Each site entry displays a status badge (active, degraded, or offline), a 30-day visitor count, aggregate page view totals, and an uptime percentage — all drawn from the `website_stats` table in real time. An aggregate row at the top of the dashboard summarizes performance across all of a client's properties in a single glance.

The dashboard is intentionally read-only for clients. All data originates from the `websites` and `website_stats` tables, which are protected by Supabase Row Level Security policies that enforce per-user visibility. Clients see exactly their own sites and nothing beyond.

## Admin Panel

Staff and admin users access a tabbed administration panel that exposes full CRUD operations across all client websites and user accounts. Admins can create, update, and delete website records for any user, adjust roles, and inspect the full client roster — all from a single, organized interface. Sensitive operations are implemented as Postgres `security definer` functions, which run with elevated privileges server-side rather than relying on permissive client-facing RLS rules.

The admin panel is isolated from client-facing routes at both the routing and database levels. Supabase RLS policies block non-admin users from accessing cross-user data regardless of what the client sends, and the React layer enforces role-based rendering before any admin UI is mounted.

## Code Architecture & Performance

The application follows a strict layered architecture: Views delegate data concerns to custom hooks, hooks interact with the Supabase client, and the Supabase client communicates with PostgreSQL. Six path aliases (`@components`, `@views`, `@hooks`, `@contexts`, `@lib`, `@data`) are configured in Vite and TypeScript, keeping imports clean and refactor-safe across the entire `src/app/` tree.

Bundle performance is managed through React 19's `lazy` with a retry wrapper (for transient network failures on chunk loads) and manually defined Vite chunk groups that isolate `recharts` and `framer-motion` into their own bundles. This prevents animation and charting libraries — which are large — from blocking the initial page load. Deployment targets Vercel with SPA rewrite rules and five security headers: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19.1 |
| Build Tool | Vite 7.1 |
| Styling | Tailwind CSS 3.4 |
| Animation | Framer Motion 12 |
| Maps | Leaflet |
| Charts | Recharts |
| Auth & Database | Supabase (PostgreSQL + RLS) |
| Deployment | Vercel |
| SEO | react-helmet-async |

### Data Flow

```
Views
  └── Custom Hooks
        └── Supabase Client
              └── PostgreSQL
                    ├── profiles (users + roles)
                    ├── websites (per-client site records)
                    └── website_stats (analytics snapshots)
```

---

## Project Stats

| Metric | Value |
|---|---|
| Routes | 18 |
| Home Page Sections | 9 |
| User Roles | 3 (client, staff, admin) |
| Path Aliases | 6 |
| Service Areas | 17 Texas cities |
| Structured Data Schemas | 3 (LocalBusiness, WebSite, FAQPage) |
| Database Tables | 3 (profiles, websites, website_stats) |
| Security Headers | 5 |

---

<p align="center"><sub>Built by <strong>Trenton Taylor</strong></sub></p>
