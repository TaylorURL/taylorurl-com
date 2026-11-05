<img src="public/images/TaylorURL-Logo.png" width="200" alt="TaylorURL" />

# TaylorURL

The website for TaylorURL, a one-person web studio in Baytown, Texas.

[taylorurl.com](https://www.taylorurl.com) · [taylor.website](https://taylor.website)

<img src="https://img.shields.io/badge/version-2026.45.26-2f6bff?style=for-the-badge" alt="Version 2026.45.26" />

The studio's own site, plus the console where clients read their site's traffic, speed and uptime. The same code also builds [taylor.website](https://taylor.website), a smaller second site for custom software, conversion tracking fixes and outbound email.

Besides the service pages, portfolio and blog, it has a few free tools (a speed check, a Google presence check, a logo background remover and a QR code generator), the project form at [/start](https://www.taylorurl.com/start), a chat assistant, and a public [status page](https://www.taylorurl.com/status). Every page is prerendered to static HTML by the plugins in `vite/`, which also write the sitemap, RSS feed and llms.txt.

## Two sites in one repo

`SITE` picks which one gets built. Both Vercel projects still deploy the whole `api/` tree and every cron, because `vercel.json` can't be keyed per site. So every endpoint checks whether this deployment is meant to serve it, and `scripts/site/check-api-gate.js` fails the tests if one forgets.

## Money and client sites

A buyer pays before they have an account, so the browser can't be trusted to record the purchase. `api/stripe-webhook.js` is the only thing that creates a project, and the signature is the security. Stripe retries deliveries, and a uniqueness rule on the checkout session turns two of them into one project. For quoted jobs, `api/checkout-link.js` makes a checkout at the agreed price, never under the floor in `pricing.js`.

A proposal is priced in a meeting, not online. The `/proposal` skill prints the sheet and saves what it printed, and the QR code on it opens `/pay` with that profile's key. The page is public and takes no sign-in, so the one thing it never sends is a price. It sends the key and the names of the add-ons ticked, and `api/proposal.js` reads every figure off the profile and refuses a name the profile doesn't offer. The worst a forged request gets is a checkout for what the sheet already offered. The key is 18 random bytes printed on paper, the whole of the access the way an unsubscribe token is. A profile that's been paid, or whose prices have run out, still reads and says which, but won't open a checkout. The checkout carries the same one-use claim key a hand-made link does, so the webhook opens the account and project the same way.

Every sheet sells the monthly fee, and some sell an add-on billed by the quarter. Stripe's checkout opens one subscription and refuses a second interval, so the longer lines are charged their first period at the checkout and `lib/stripe/proposal.js` opens them as their own subscription from the webhook, each starting one period on. Nothing is billed twice and nothing is left unbilled. Stripe retries the webhook, so each subscription is opened under a key named after the checkout and a later delivery finds it done.

Every client site's middleware asks `api/site-status.js` whether to serve. The answer is no only when the client has an invoice unpaid a week past due. It reads Stripe live rather than keeping a copy, and the edge caches it for five minutes. No row, no customer or an exemption all mean serve. I'd rather a site stay up by mistake than go down by mistake.

A file too big to email a client, like print-ready artwork, goes in the `client-files` Blob store, and `/files/<path>` in `vercel.json` hands it out from taylorurl.com as a download. The store is public, so nothing private goes in it.

The console works out who is asking from the session the browser presented, never from an account id in the request. The studio's own screens hold every request to the admin role in `lib/db/clients.js`. A client's screens forward that session to the Supabase function that owns the data and let it answer, so the proxy in `api/` has no second opinion on who is asking.

## The chat assistant and outreach

The assistant runs on my own machine. A serverless function can't hold a thread open, so `api/live-chat.js` meters turns and forwards them. When the machine is down the widget isn't drawn, and a thread that's already open still takes an email address and mails it on.

The outreach decisions moved out into [chainwork](https://github.com/TaylorURL/chainwork), installed as a dependency, so a second site can run them. A chain is the letters, the days between them, what puts a business on it and what takes it off. There are ten under `lib/outreach/chains`: a file each for the four the studio has always had, and one file holding the six that fire on something that just happened, like a certificate that expired or a Google listing with no photos. The six share a file because they're the same shape, with a different defect read off the row. The old paths under `lib/outreach/` are re-exports now, so nothing that imported them had to move.

The time zone, the held-domain list and the domains I own are installed into the package from here. Those are facts about the studio rather than decisions about outreach.

`api/outreach/send.js` drafts every message but only hands one to a mail server when `sending_enabled` is on in the console and `OUTREACH_SEND_ARMED` is set on the deployment. Either one off and it stays a draft.

The Call List is the phone side. `callScore.js` reads three things off a business before anybody rings it: whether the owner picks up, whether it needs a site, whether it can pay. They get multiplied, so one bad reading sinks a business however well it reads on the other two. Owner and budget start from Census figures for the trade, loaded into a table by `scripts/db/census-trade-metrics.py`. Once a trade has twenty calls somebody picked up, its own pick-up rate replaces the Census figure. `callList.js` drops rows before anybody sees them: a chain, a number shared by three listings, a Google listing with no reviews, anything Google says is closed. Each of those is a call that was already wasted. The businesses that answered the mail lead the list ahead of any score: one that wrote back, or that a person opened twice. `engaged.js` doesn't count an open inside ten minutes of the send, because that one is a mail scanner fetching the picture. They get rung whatever site they have, since the sender has already written and been read. A call that turns into a real conversation is filed in the sales pipeline with a follow-up day, and that business is off the list for good. The page counts the day against a goal of fifty.

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
