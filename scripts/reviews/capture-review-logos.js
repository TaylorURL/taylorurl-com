/**
 * Regenerates the reviewer marks in `public/images/reviews/`.
 *
 * A review card is stronger for showing the mark of the business that left it,
 * and every one of those businesses already publishes its mark as the icon its
 * own site loads. So the mark is taken from the site rather than drawn again
 * here, which means a client who rebrands only has to rebrand once.
 *
 * The site's declared icons are read out of its markup and the largest is
 * taken, falling back to `/apple-touch-icon.png` and then `/favicon.ico` for a
 * site that declares nothing. Sizes come from the `sizes` attribute where it is
 * given and from the file itself where it is not, because a site is free to
 * declare a size it does not serve.
 *
 * An icon is drawn for a tab and a home screen and usually carries a square of
 * ground for them. The card stands the mark on its own paper, so the square is
 * keyed off by `key-mark.py` before the file is placed. It is placed under a
 * name that ends in the hash of its bytes, and `review-marks.js` is rewritten
 * to say which name each site's mark is under. `/images/` is served immutable
 * for a year, so a mark written back under the name a browser already holds
 * would never be seen again by anyone who had seen the old one; the hash gives
 * a changed mark a new name and an unchanged one its old name, and the card
 * reads the manifest rather than guessing.
 *
 * Run it whenever a client changes their mark:
 *
 *   npm run capture:review-logos                      every reviewer
 *   npm run capture:review-logos -- tiretracker.app   only these display URLs
 *
 * The output is committed. A card that fetched a mark from the client's own
 * server on every page view would hand each visitor's address to three other
 * sites and lose the card whenever one of them was down. It needs macOS for
 * `sips` and Pillow for the keying.
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { REVIEW_MARKS } from '../../src/app/data/reputation/review-marks.js'
import { CLIENT_REVIEW_LIST } from '../../src/app/data/reputation/reviews.js'

const run = promisify(execFile)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const MARKS = join(ROOT, 'public/images/reviews')
const MANIFEST = join(ROOT, 'src/app/data/reputation/review-marks.js')
const KEY_MARK = join(ROOT, 'scripts/reviews/key-mark.py')

// Twice the 44px the card draws the mark at, rounded up to the next icon size a
// site is likely to actually serve. Anything larger is bytes a visitor pays for
// and never sees.
const EDGE = 96

/** Every icon a page declares, largest first. */
function declaredIcons(html, origin) {
  const links = html.match(/<link[^>]+>/gi) ?? []
  return links
    .filter(tag => /rel=["'][^"']*icon/i.test(tag))
    .map(tag => {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
      const declared = tag.match(/sizes=["'](\d+)x\d+["']/i)?.[1]
      if (!href) return null
      // An apple-touch-icon that declares no size is 180, which is the size
      // Apple asks for and the size sites serve. Reading it as nothing puts it
      // behind a 48px favicon, and the tile then upscales the smaller file.
      const touch = /rel=["'][^"']*apple-touch-icon/i.test(tag)
      return { url: new URL(href, origin).href, size: Number(declared ?? (touch ? 180 : 0)) }
    })
    .filter(Boolean)
    .sort((first, second) => second.size - first.size)
}

/**
 * Writes the best icon a site serves to `out`, squared to the mark's size.
 *
 * Largest first, and the first candidate that both downloads and converts wins.
 * A site is free to declare an icon it does not serve, and free to serve one in
 * a format sips will not open, so a candidate is only proved by converting it.
 */
async function captureIcon(displayUrl, out, staged) {
  const origin = `https://${displayUrl}`
  const page = await fetch(origin, { redirect: 'follow' })
  const candidates = [
    ...declaredIcons(await page.text(), origin),
    { url: `${origin}/apple-touch-icon.png`, size: 0 },
    { url: `${origin}/favicon.ico`, size: 0 },
  ]

  for (const candidate of candidates) {
    const response = await fetch(candidate.url, { redirect: 'follow' })
    if (!response.ok) continue
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length) continue
    await writeFile(staged, bytes)
    try {
      // sips squares the result so three marks of different proportions sit on
      // one row without one of them being the tall card.
      await run('sips', [
        '-s',
        'format',
        'png',
        '-z',
        String(EDGE),
        String(EDGE),
        staged,
        '--out',
        out,
      ])
      return candidate.url
    } catch {
      continue
    }
  }
  throw new Error(`no usable icon for ${displayUrl}`)
}

/**
 * The name a mark is held under: the site it belongs to, then eight characters
 * of the hash of its bytes, so the name changes exactly when the picture does.
 */
function markName(displayUrl, bytes) {
  const site = displayUrl.replace(/[^a-z0-9]+/gi, '-')
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8)
  return `${site}-${hash}.png`
}

/**
 * The manifest the card reads, one line per site in a fixed order, so a
 * recapture of one mark diffs as one line.
 */
function manifest(marks) {
  const lines = Object.keys(marks)
    .sort()
    .map(site => `  '${site}': '${marks[site]}',`)
  return `/**
 * Written by \`npm run capture:review-logos\`, never by hand.
 *
 * Each reviewer's mark, by the site the review is about, under the name the
 * file is held at. The name ends in the hash of the file's own bytes because
 * \`/images/\` is served immutable for a year: a browser that has seen a mark
 * never asks for it again under the same name, so a recaptured mark has to
 * arrive under a new one, and the hash is what makes that happen without
 * anybody remembering to rename it.
 */
export const REVIEW_MARKS = {
${lines.join('\n')}
}
`
}

const wanted = process.argv.slice(2)
const targets = wanted.length
  ? CLIENT_REVIEW_LIST.filter(review => wanted.includes(review.displayUrl))
  : CLIENT_REVIEW_LIST

const marks = { ...REVIEW_MARKS }
await mkdir(MARKS, { recursive: true })
for (const review of targets) {
  const staged = join(ROOT, 'node_modules/.cache', `review-icon-${review.displayUrl}`)
  const squared = `${staged}.png`
  await mkdir(dirname(staged), { recursive: true })
  const from = await captureIcon(review.displayUrl, squared, staged)
  const { stdout: keyed } = await run('python3', [KEY_MARK, squared])
  const bytes = await readFile(squared)
  const name = markName(review.displayUrl, bytes)
  const previous = marks[review.displayUrl]
  if (previous && previous !== name) await rm(join(MARKS, previous), { force: true })
  await writeFile(join(MARKS, name), bytes)
  marks[review.displayUrl] = name
  console.log(`${review.displayUrl} <- ${from}\n  ${keyed.trim()}\n  -> ${name}`)
}
await writeFile(MANIFEST, manifest(marks))
