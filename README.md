<p align="center">
  <img src="public/images/TaylorURL-Logo.png" width="200" alt="TaylorURL" />
</p>

<h1 align="center">TaylorURL</h1>

<p align="center">The website for TaylorURL, a one-person web studio in Baytown, Texas.</p>

<p align="center">
  <a href="https://www.taylorurl.com">taylorurl.com</a> · <a href="https://taylor.website">taylor.website</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2026.44.11-2f6bff?style=for-the-badge" alt="Version 2026.44.11" />
</p>

TaylorURL builds websites and web apps for local businesses around Houston. This repo is the studio's own site, plus the console clients sign in to while their site is being built.

The same code also builds [taylor.website](https://taylor.website), a second, smaller site that sells custom software, conversion tracking fixes and outbound email to companies anywhere.

## What's on the site

- Service pages, from new sites and redesigns to booking, company email, SEO and hosting
- A portfolio of client sites, with case studies
- Pages for the industries and towns the studio works with
- A blog, grouped into series, with an RSS feed
- Free tools: a speed check, a Google presence check, a logo background remover and a QR code generator
- A project form at [/start](https://www.taylorurl.com/start) and a chat assistant that answers questions about the work
- A console where clients fill in their project brief, follow their build and see their site's traffic, plus a public [status page](https://www.taylorurl.com/status)

## Running it locally

Needs Node 22.

```bash
npm install
npm run dev
```

The pages and forms work locally with no setup. The serverless functions in `api/` read server-side keys (Supabase, Resend, Stripe, Google and a few others) that are set in Vercel. `.env.example` lists every one with a short note.

Other commands:

```bash
npm run build                    # build taylorurl.com
SITE=taylorwebsite npm run build # build taylor.website
npm test                         # run the checks in scripts/
npm run lint
npm run format:check
```

## Project layout

| Folder     | What's in it                                                      |
| :--------- | :---------------------------------------------------------------- |
| `src/`     | The React app: pages, components and content                      |
| `api/`     | Vercel functions: contact form, checkout, chat and scheduled jobs |
| `lib/`     | Code shared by the functions and the console                      |
| `vite/`    | Build plugins for prerendering, the sitemap, RSS and llms.txt     |
| `scripts/` | The checks `npm test` runs, plus screenshot and audit tools       |
| `public/`  | Images, fonts and other static files                              |

## Built with

React 19, Vite, Tailwind CSS, Framer Motion, Supabase, Stripe and Resend. Every page is prerendered to static HTML at build time. Hosted on Vercel.

## License

Proprietary. The code is public to read, but all rights are reserved and outside contributions aren't accepted. See [LICENSE.md](LICENSE.md).
