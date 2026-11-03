/**
 * What a source is called.
 *
 * The collector files an arrival under the host that sent it and nothing more,
 * so the name a reader sees is read from that host. It lives here rather than
 * in a section so every list naming arrivals names them the same way.
 */

// What the collector calls an arrival that carried no referrer.
const DIRECT = 'direct'

/** The host a source names, however the collector spelled it. */
function hostOf(source) {
  return String(source || '')
    .toLowerCase()
    .replace(/^[a-z][\w+.-]*:\/\//, '')
    .split('/')[0]
}

/**
 * A source as a reader should see it: the host without the `www.` nobody says
 * out loud, and the word "Direct" for an arrival that carried no referrer.
 *
 * A person did not come from `www.google.com` - they came from Google. The
 * host is kept otherwise, since which subdomain of a partner sent somebody is
 * the whole answer on a referral.
 */
export function sourceLabel(source) {
  const host = hostOf(source)
  if (!host || host === DIRECT) return 'Direct'
  return host.replace(/^www\./, '')
}
