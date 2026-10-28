<img src="public/images/TaylorURL-Logo.png" width="200" alt="TaylorURL" />

# TaylorURL

The website for TaylorURL, a one-person web studio in Baytown, Texas.

[taylorurl.com](https://www.taylorurl.com) · [taylor.website](https://taylor.website)

<img src="https://img.shields.io/badge/version-2026.44.14-2f6bff?style=for-the-badge" alt="Version 2026.44.14" />

The studio's own site, plus the console clients sign in to while their site is built. The same code builds [taylor.website](https://taylor.website), a smaller second site for custom software, conversion tracking fixes and outbound email.

<details>
<summary>What's on the site</summary>

- Service pages, a portfolio with case studies, industry and town pages, and a blog with series and an RSS feed.
- Free tools: a speed check, a Google presence check, a logo background remover and a QR code generator.
- A project form at [/start](https://www.taylorurl.com/start) and a chat assistant.
- A client console for the project brief, build progress and site traffic, plus a public [status page](https://www.taylorurl.com/status).

</details>

## How it's built

- **Two sites, one repo.** `SITE` picks the build. Both Vercel projects deploy the whole `api/` tree and every cron, since `vercel.json` can't be keyed per site. So every endpoint checks whether this deployment serves it, and `scripts/site/check-api-gate.js` fails the tests if one doesn't.
- **Prerendered.** Plugins in `vite/` render every page to static HTML and write the sitemap, RSS feed and llms.txt.
- **Payment opens the project.** A buyer pays before they have an account, so the browser can't record the purchase. `api/stripe-webhook.js` is the only way a project gets created. The signature is the security. Stripe retries, so a uniqueness rule on the checkout session makes two deliveries one project.
- **Quoted jobs get a link.** `api/checkout-link.js` makes a checkout for an agreed price. It can't go under the floor in `pricing.js`.
- **Client sites ask whether to serve.** Every client site's middleware calls `api/site-status.js` on page load. It says no-serve when the client has an invoice unpaid a week past due. It reads Stripe live instead of keeping a copy, and the edge caches the answer for five minutes. No row, no customer or an exemption all mean serve.
- **Console reads are scoped to the session.** `api/projects.js` keys every read and write on the caller's verified session. Nothing takes an account id as an argument.
- **The chat assistant runs on my own machine.** A serverless function can't hold a thread, so `api/live-chat.js` meters and forwards turns to it. If that machine is down, the widget isn't drawn. A thread already open still takes an address and mails it on.
- **Outreach sends need two switches.** `api/outreach/send.js` drafts every message, but only hands it to a mail server when `sending_enabled` is on in the console and `OUTREACH_SEND_ARMED` is set on the deployment. Either off and it stays a draft.

<details>
<summary>Tests</summary>

`npm test` runs the checks in `scripts/`, each a plain Node script. A few that matter:

- `check-public-repo.js`: the repo is public, so no Stripe ids, customer mailboxes or suppressed domains can appear in source. Fixtures use RFC 2606 reserved domains.
- `check-api-gate.js`: every endpoint is gated per site.
- `check-attribution-guard.js`, `check-central-time.js`, `check-internal-links.js` and checks for the console, auth doors, outreach, mail and free tools.

</details>

<details>
<summary>Running it locally</summary>

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

</details>

<details>
<summary>Project layout</summary>

| Folder     | What's in it                                                      |
| :--------- | :---------------------------------------------------------------- |
| `src/`     | The React app: pages, components and content                      |
| `api/`     | Vercel functions: contact form, checkout, chat and scheduled jobs |
| `lib/`     | Code shared by the functions and the console                      |
| `vite/`    | Build plugins for prerendering, the sitemap, RSS and llms.txt     |
| `scripts/` | The checks `npm test` runs, plus screenshot and audit tools       |
| `public/`  | Images, fonts and other static files                              |

</details>

## Built with

React 19, Vite, Tailwind CSS, Framer Motion, Supabase, Stripe and Resend. Every page is prerendered to static HTML at build time. Hosted on Vercel.

<details>
<summary>License</summary>

Proprietary. The code is public to read, but all rights are reserved and outside contributions aren't accepted. See [LICENSE.md](LICENSE.md).

</details>
