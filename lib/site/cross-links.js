/**
 * Every destination one site names on the other.
 *
 * Two deployments, two origins, one company. A reader who lands on either should
 * be able to reach the rest of what the company does without being told there is
 * a second business, so the chrome carries rows pointing across. Those rows are
 * the only links in the tree that leave the origin they are drawn on and are
 * still ours, and they are the ones nothing was checking.
 *
 * `check-internal-links.js` reads the built HTML, strips the building site's own
 * origin and skips everything else with a scheme. That is correct for Facebook
 * and correct for a review profile, and it is exactly wrong here: a row naming
 * `https://taylor.website/services/outbound` is unvalidated on the studio build,
 * load-bearing on the subsidiary build, and a page that quietly stops being
 * published on one site leaves a dead row in the other site's chrome with every
 * gate green. Worse, the two builds disagree about which of them was even
 * looking. Holding the rows as data is what lets `check-cross-links.js` resolve
 * each one against the route table of the site that actually serves it.
 *
 * This file holds data and nothing else, for the reason `registry.js` gives: the
 * same module is pulled into a browser chunk, into `vite.config.js` and into a
 * check script run under bare node, and an import that resolves for one of those
 * does not resolve for the others.
 *
 * `site` names the site that SERVES the path, not the site that draws the row.
 * A row is drawn on every site except that one, which is what makes a single
 * list describe both directions. `path` is rooted and carries no origin, because
 * the origin is the reader's side of the question and is filled in from
 * `SITE.siblingOrigin` at the point of use.
 */
export const CROSS_LINKS = [
  {
    key: 'sibling-home',
    site: 'taylorwebsite',
    path: '/',
    label: 'Taylor',
    summary: 'Software, tracking repair, and outbound, for companies anywhere.',
  },
  {
    key: 'sibling-home-back',
    site: 'taylorurl',
    path: '/',
    label: 'TaylorURL',
    summary: 'Custom websites for local businesses around Baytown and Houston.',
  },
]
