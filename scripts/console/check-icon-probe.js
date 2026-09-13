/**
 * Holds the two halves of the site-icon fallback together.
 *
 * The console draws a client's own mark from `public/site-icons` where one has
 * been captured, and where none has it guesses the site's favicon at three
 * conventional paths before giving up and drawing a lettered tile. A site that
 * answers at one of the three 404s at the other two by definition, and a site
 * that declares its icon anywhere else - `/favicon-32.png`, say - 404s at all
 * three. None of that is a broken image. The visitor gets the tile the fallback
 * was written to draw.
 *
 * The page's error collector cannot see that on its own. It reports every
 * element load failure on the page, so those guesses reached the collector as
 * defects on the client's site and were filed as such: three tickets for one
 * host with its icon at an unconventional path, and three more for the next
 * host added to the board.
 *
 * So a guess carries `data-probe` and the collector holds it rather than filing
 * it. That contract lives in two files that know nothing about each other, and
 * dropping either half restores the old behaviour silently - the console still
 * draws, the collector still collects, and the only symptom is tickets arriving
 * again some days later. This is what says so at the time.
 *
 * The second half is the icon set itself: a capture writes a PNG and registers
 * its host in two separate steps, and either one alone leaves a mark that is
 * committed but never drawn, or named but missing.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect as check, finish } from '../harness/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const ICON = 'src/app/views/console/SiteIcon.jsx'
const COLLECTOR = 'index.html'
const REGISTRY = 'src/app/data/console/siteIcons.js'
const ICONS = 'public/site-icons'

const read = where => readFileSync(join(ROOT, where), 'utf8')

// The component marks its guesses.
const component = read(ICON)
check(
  /data-probe=\{/.test(component),
  `${ICON} no longer puts data-probe on the mark, so every guess it makes is filed as a broken image`
)
check(
  /const probing = !captured && !found/.test(component),
  `${ICON} decides what a probe is some other way; a captured or remembered mark must not carry data-probe`
)

// The collector honours the mark, and only for the load failures it names.
const collector = read(COLLECTOR)
check(
  /hasAttribute\('data-probe'\)/.test(collector),
  `${COLLECTOR} no longer reads data-probe, so the console's favicon guesses are filed as defects on the client's site`
)
check(
  /hold\('probe'/.test(collector),
  `${COLLECTOR} drops a probe instead of holding it; a probe that stops answering has to stay visible in the live console`
)
// The exemption is worth exactly one element attribute. A collector that
// stopped reporting resource failures altogether would pass the two checks
// above and report nothing at all.
check(
  /report\(\s*'resource',/.test(collector),
  `${COLLECTOR} no longer reports resource failures at all, which is more than the probe exemption asks for`
)

// The icon set: every registered host has a file, every file has a host.
const registry = read(REGISTRY)
const listed = new Set(
  (registry.match(/const CAPTURED = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '')
    .match(/'([a-z0-9.-]+)'/g)
    ?.map(quoted => quoted.slice(1, -1)) ?? []
)
check(
  listed.size > 0,
  `${REGISTRY} lists no captured hosts, so the console draws letters for everything`
)

const committed = new Set(
  readdirSync(join(ROOT, ICONS))
    .filter(name => name.endsWith('.png'))
    .map(name => name.slice(0, -4))
)
for (const host of listed) {
  check(committed.has(host), `${REGISTRY} names ${host} but ${ICONS}/${host}.png is not committed`)
}
for (const host of committed) {
  check(
    listed.has(host),
    `${ICONS}/${host}.png is committed but ${REGISTRY} does not name it, so the console guesses at ${host}'s favicon instead of drawing the mark already here`
  )
}

await finish()
console.log(
  `icon probe: guesses marked and held rather than filed; ${listed.size} captured marks all committed and registered`
)
