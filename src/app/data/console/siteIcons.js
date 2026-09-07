/**
 * The client marks the console draws, and the ground each one needs under it.
 *
 * A borrowed mark taken straight from its own host is whatever that host
 * happens to serve, at whatever size, on whatever ground, and a column of those
 * is not a set. Each of these is fetched once, lifted off any ground it was
 * baked onto, trimmed and centred, and committed as a 64px PNG with an alpha
 * channel, so every one is the same shape of file at the same optical weight.
 *
 * They are then drawn in their own colours, because at twenty pixels colour is
 * what identifies a brand. Draining it makes a badge into a grey blob and a
 * wordmark into a smear, and a column of grey blobs is harder to read down than
 * the same column of logos ever was. What a column of logos actually fights
 * over is inconsistent size, crop and ground, and those are settled at the
 * point of capture rather than papered over with a filter.
 *
 * What is left after that is one real problem, and it belongs to individual
 * marks rather than to all of them: artwork drawn in pale ink disappears on a
 * pale tile. So the ground is chosen per icon from the artwork's own luminance
 * at capture time, and recorded here.
 *
 * `scripts/console/capture-site-icons.py` writes both the files and this list. Run it
 * when a site joins or changes its mark; a host it cannot reach keeps the icon
 * already committed. A host absent from here still gets an icon - the component
 * falls back to the site's own favicon and then to a lettered tile - so nothing
 * has to be added here for a new site to look right.
 */

/** Marks whose artwork is pale enough to need a dark tile behind it. */
const DARK_GROUND = new Set(['deluxfitbyangie.com'])

const CAPTURED = new Set([
  'baytowngokarts.com',
  'baytownwebdevelopment.com',
  'ccscaleservices.com',
  'deluxfitbyangie.com',
  'deluxlavello.com',
  'dickinsonbayoufleeting.com',
  'djrxexcellence.com',
  'faded-barbershop.com',
  'hollingsheadharbor.com',
  'impressivaprinting.com',
  'rootriseholdings.com',
  'setxfootball.org',
  'smyrnatools.com',
  'taylor.website',
  'taylorurl.com',
  'tiretracker.app',
])

/** Where a captured icon lives, or null for a host that has none. */
export function capturedIcon(host) {
  return CAPTURED.has(host) ? `/site-icons/${host}.png` : null
}

/** Which ground a host's mark reads on. */
export function iconGround(host) {
  return DARK_GROUND.has(host) ? 'dark' : 'light'
}
