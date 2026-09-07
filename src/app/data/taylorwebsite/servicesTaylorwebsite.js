/**
 * The three services taylor.website sells, and what each one's page says.
 *
 * Same shape as `@data/services`, because the same index and the same
 * navigation panel render both sites. What differs is the offer, not the design.
 *
 * Imports nothing, and must not. `vite/site-routes.js` reads this to build the
 * route table, and it runs under plain node inside Vite's config load, where no
 * path alias resolves and no JSX compiles. The page content, which needs both,
 * lives in serviceDetailTaylorwebsite.js instead.
 *
 * The studio sells websites to businesses in the towns around Baytown. This
 * sells engineering, tracking repair and outbound to companies anywhere, so
 * nothing here names a town, a trade or a locality, and nothing quotes a rating
 * or a client, because this site has neither yet.
 */
const LINES = [
  {
    slug: 'software-engineering',
    name: 'Software Engineering',
    summary: 'Applications, integrations and internal tools, built to order.',
  },
  {
    slug: 'tracking-repair',
    name: 'Tracking Repair',
    summary: 'Ad tracking that reports the leads that actually came in.',
  },
  {
    slug: 'outbound',
    name: 'Outbound Email',
    summary: 'Cold email run from a sending domain of your own.',
  },
]

export const SERVICE_LINES = LINES.map(line => ({ ...line, path: `/services/${line.slug}` }))
