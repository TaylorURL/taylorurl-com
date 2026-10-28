<img src="public/images/TaylorURL-Logo.png" width="200" alt="TaylorURL" />

# TaylorURL

The website for TaylorURL, a one-person web studio in Baytown, Texas.

[taylorurl.com](https://www.taylorurl.com) · [taylor.website](https://taylor.website)

<img src="https://img.shields.io/badge/version-2026.44.21-2f6bff?style=for-the-badge" alt="Version 2026.44.21" />

The studio's own site, plus the console clients sign in to while their site is built. The same code also builds [taylor.website](https://taylor.website), a smaller second site for custom software, conversion tracking fixes and outbound email.

Besides the service pages, portfolio and blog, it has a few free tools (a speed check, a Google presence check, a logo background remover and a QR code generator), the project form at [/start](https://www.taylorurl.com/start), a chat assistant, and a public [status page](https://www.taylorurl.com/status). Every page is prerendered to static HTML by the plugins in `vite/`, which also write the sitemap, RSS feed and llms.txt.

## Two sites in one repo

`SITE` picks which one gets built. Both Vercel projects still deploy the whole `api/` tree and every cron, because `vercel.json` can't be keyed per site. So every endpoint checks whether this deployment is meant to serve it, and `scripts/site/check-api-gate.js` fails the tests if one forgets.

## Money and client sites

A buyer pays before they have an account, so the browser can't be trusted to record the purchase. `api/stripe-webhook.js` is the only thing that creates a project, and the signature is the security. Stripe retries deliveries, and a uniqueness rule on the checkout session turns two of them into one project. For quoted jobs, `api/checkout-link.js` makes a checkout at the agreed price, never under the floor in `pricing.js`.

Every client site's middleware asks `api/site-status.js` whether to serve. The answer is no only when the client has an invoice unpaid a week past due. It reads Stripe live rather than keeping a copy, and the edge caches it for five minutes. No row, no customer or an exemption all mean serve. I'd rather a site stay up by mistake than go down by mistake.

The console keys every read and write in `api/projects.js` on the caller's verified session. Nothing takes an account id as an argument.

## The chat assistant and outreach

The assistant runs on my own machine. A serverless function can't hold a thread open, so `api/live-chat.js` meters turns and forwards them. When the machine is down the widget isn't drawn, and a thread that's already open still takes an email address and mails it on.

`api/outreach/send.js` drafts every message but only hands one to a mail server when `sending_enabled` is on in the console and `OUTREACH_SEND_ARMED` is set on the deployment. Either one off and it stays a draft.

## Tests

`npm test` runs the plain Node scripts in `scripts/`. The important one is `check-public-repo.js`. The repo is public, so it fails on any Stripe id, customer mailbox or suppressed domain in source, and fixtures stick to RFC 2606 reserved domains. Others cover the per-site API gate, attribution, Central time handling, internal links, the console, auth, outreach, mail and the free tools.

<details>
<summary>Running it locally</summary>

Needs Node 22.

```bash
npm install
npm run dev
npm run build                    # taylorurl.com
SITE=taylorwebsite npm run build # taylor.website
npm test
npm run lint
npm run format:check
```

The pages and forms work locally with no setup. The functions in `api/` read server-side keys (Supabase, Resend, Stripe, Google and a few others) set in Vercel. `.env.example` lists each one with a note.

`src/` is the React app, `api/` the functions and scheduled jobs, `lib/` code shared by the functions and the console, `vite/` the build plugins, `scripts/` the checks plus screenshot and audit tools, and `public/` static files.

</details>

React 19, Vite, Tailwind CSS, Framer Motion, Supabase, Stripe and Resend, on Vercel.

The code is public to read, but it's proprietary: all rights are reserved and outside contributions aren't accepted. See [LICENSE.md](LICENSE.md).
