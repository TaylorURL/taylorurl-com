/**
 * Regenerates the reviewer logos in `public/images/reviews/`.
 *
 * A review card is stronger for showing the mark of the business that left it,
 * and every one of those businesses already publishes its mark as the icon its
 * own site loads. So the logo is taken from the site rather than drawn again
 * here, which means a client who rebrands only has to rebrand once.
 *
 * The site's declared icons are read out of its markup and the largest is
 * taken, falling back to `/apple-touch-icon.png` and then `/favicon.ico` for a
 * site that declares nothing. Sizes come from the `sizes` attribute where it is
 * given and from the file itself where it is not, because a site is free to
 * declare a size it does not serve.
 *
 * Run it whenever a client changes their mark:
 *
 *   npm run capture:review-logos                      every reviewer
 *   npm run capture:review-logos -- tiretracker.app   only these display URLs
 *
 * The output is committed. A card that fetched a logo from the client's own
 * server on every page view would hand each visitor's address to three other
 * sites and lose the card whenever one of them was down.
 */
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { CLIENT_REVIEW_LIST, reviewLogoSrc } from '../../src/app/data/reputation/reviews.js'

const run = promisify(execFile)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Twice the 44px the card draws the tile at, rounded up to the next icon size a
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
 * Writes the best icon a site serves to `out`, squared to the tile size.
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

const wanted = process.argv.slice(2)
const targets = wanted.length
  ? CLIENT_REVIEW_LIST.filter(review => wanted.includes(review.displayUrl))
  : CLIENT_REVIEW_LIST

for (const review of targets) {
  const out = join(ROOT, 'public', reviewLogoSrc(review.displayUrl))
  const staged = join(ROOT, 'node_modules/.cache', `review-icon-${review.displayUrl}`)
  await mkdir(dirname(out), { recursive: true })
  await mkdir(dirname(staged), { recursive: true })
  console.log(`${review.displayUrl} <- ${await captureIcon(review.displayUrl, out, staged)}`)
}
