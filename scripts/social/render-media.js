/**
 * Renders the social media library: image cards, carousels and short vertical
 * videos, in the studio's own sheet, from the site's own data.
 *
 *   npm run social:render                       everything
 *   npm run social:render -- --only trade-,video-53
 *   npm run social:render -- --skip-video       images and carousels only
 *   npm run social:render -- --copy out.txt     write every line of copy and stop
 *
 * Output lands in `public/social/library/`, which the site serves at
 * `/social/library/<file>`, and the manifest in `lib/social/library.json`. A
 * full run writes both from scratch and removes any file in the folder the
 * manifest no longer names, so the folder is always exactly what the manifest
 * says. Re-running regenerates the same files: every frame is a function of the
 * copy and of `t`, never of a clock.
 *
 * Nothing is written that fails a guard. Every page's text is read back out of
 * the browser after layout and checked for client names, prices, the voice of a
 * team and emoji; copy that does not fit its box at its smallest permitted
 * size fails the run instead of shipping clipped; and every `to` must be a page
 * this build prerenders.
 *
 * Chromium is whatever `PLAYWRIGHT_CHROMIUM` names, else the newest one
 * Playwright has cached, else `/usr/bin/chromium-browser` (the Pi). Finding it,
 * the sheet and the guards are in `media-sheet.js` and `media-guard.js`, shared
 * with the renderer that draws review and proof cards from live data.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRERENDER_ROUTES } from '../../vite/site-routes.js'
import * as T from './media-templates/templates.js'
import { library } from './media-content.js'
import { altGuard } from './media-guard.js'
import { launch, renderClip, renderStill, sheet } from './media-sheet.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(ROOT, 'public', 'social', 'library')
const MANIFEST = join(ROOT, 'lib', 'social', 'library.json')
const MAX_VIDEO_BYTES = 4 * 1024 * 1024

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const only = option('--only')?.split(',').filter(Boolean) ?? null
const skipVideo = flag('--skip-video')
const copyOut = option('--copy')

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

// The text rules themselves are in `media-guard.js` and the fit and the read-back
// in `media-sheet.js`, shared with `generated-cards.js`, so a card drawn on the
// Pi from live data is refused for exactly what a library card is refused for.

const ROUTES = new Set(
  PRERENDER_ROUTES.map(route => (typeof route === 'string' ? route : route.path))
)

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const TEMPLATES = {
  number: T.numberCard,
  check: T.checkCard,
  disagreement: T.disagreementCard,
  'before-after': T.beforeAfterCard,
  teaser: T.teaserCard,
  trade: T.tradeCard,
  area: T.areaCard,
  faq: T.faqCard,
}

const p = T.plain
const stop = text => (/[.?!:]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)

/** What a reader who cannot see the card is given: all of it, in reading order. */
function altFor(item) {
  switch (item.format) {
    case 'number':
      return `${p(item.figure)} ${p(item.label)} What it costs you: ${p(item.cost)} ${p(item.source)}`
    case 'check':
      return `Try this on your phone, in under a minute. ${p(item.headline)} ${item.steps.map((step, i) => `${i + 1}. ${p(step)}`).join(' ')}`
    case 'disagreement':
      return `Heard in the trade, and struck through: "${item.belief}" What actually happens: ${p(item.headline)} ${p(item.why)}`
    case 'before-after':
      return `${item.subject}. ${p(item.headline)} ${item.pairs
        .map(
          pair =>
            `${pair.strategy} score: ${pair.before.score} in ${pair.before.when}, ${pair.after.score} in ${pair.after.when}.`
        )
        .join(' ')} ${p(item.source)}`
    case 'teaser':
      return `${item.eyebrow}. ${stop(p(item.headline))} ${stop(p(item.dek))} Read it on the blog.`
    case 'trade':
      return `${item.eyebrow}. ${p(item.headline)} What the site has to do: ${item.items.map(p).join('; ')}.`
    case 'area':
      return `${item.eyebrow}. ${p(item.town)} ${stop(p(item.title))} ${p(item.lede)} Trades: ${item.chips.join(', ')}.`
    case 'faq':
      return `Question: ${p(item.question)} Answer: ${p(item.answer)}`
    default:
      throw new Error(`render-media: no alt for format ${item.format}`)
  }
}

function slidesFor(set) {
  const total = set.slides.length + 2
  return [
    { spec: T.coverSlide(set, total), alt: `${p(set.cover)} ${p(set.sub)} Swipe through.` },
    ...set.slides.map((slide, index) => ({
      spec: T.pointsSlide(set, slide, index + 1, total),
      alt: slide.points
        .map(point => `${point.n.replace(' · ', ', ')}. ${stop(p(point.title))} ${p(point.body)}`)
        .join(' '),
    })),
    {
      spec: T.closeSlide(set, total),
      alt: `${p(set.close.headline)} ${p(set.close.body)} ${set.close.path}`,
    },
  ]
}

/** One library video, cut by the sheet's own `renderClip`, with its poster beside it. */
async function renderVideo(page, video, shared, runtime) {
  const file = `${video.key}.mp4`
  const poster = `${video.key}-poster.png`
  await renderClip(page, T.videoPage(video, shared, runtime), video, join(OUT, file), {
    poster: join(OUT, poster),
  })
  const bytes = readFileSync(join(OUT, file)).length
  if (bytes > MAX_VIDEO_BYTES)
    throw new Error(
      `render-media: ${file} is ${(bytes / 1048576).toFixed(2)} MB, over the 4 MB ceiling`
    )
  return { file, poster, alt: video.alt }
}

/** Run `work` over `items` on `size` pages at once, keeping the input order. */
async function pool(browser, viewport, items, size, work) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
      const page = await context.newPage()
      while (next < items.length) {
        const index = next++
        results[index] = await work(page, items[index])
      }
      await context.close()
    })
  )
  return results
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  const items = await library(T.fx)

  const keys = new Set()
  for (const item of items) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.key))
      throw new Error(`render-media: key "${item.key}" is not kebab-case`)
    if (keys.has(item.key)) throw new Error(`render-media: key "${item.key}" is used twice`)
    keys.add(item.key)
    if (!ROUTES.has(item.to))
      throw new Error(
        `render-media: ${item.key} links to ${item.to}, which the site does not serve`
      )
  }

  if (copyOut) {
    const lines = items.map(item =>
      item.kind === 'image'
        ? altFor(item)
        : item.kind === 'carousel'
          ? slidesFor(item)
              .map(slide => slide.alt)
              .join('\n')
          : ''
    )
    writeFileSync(copyOut, `${lines.filter(Boolean).join('\n\n')}\n`)
    console.log(
      `render-media: copy for ${items.length} items written to ${copyOut} (video captions are read off the rendered page)`
    )
    return
  }

  const chosen = item => !only || only.some(part => item.key.includes(part))
  mkdirSync(OUT, { recursive: true })
  const browser = await launch()
  const { shared, runtime } = await sheet(browser)
  const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : []
  const before = new Map(previous.map(entry => [entry.key, entry]))
  const manifest = new Map()
  const shrunk = []

  const stills = items.filter(item => item.kind !== 'video' && chosen(item))
  await pool(browser, T.IMAGE, stills, 4, async (page, item) => {
    if (item.kind === 'image') {
      const spec = TEMPLATES[item.format](item)
      const file = `${item.key}.png`
      const { fit } = await renderStill(
        page,
        T.page({ size: T.IMAGE, ...spec }, shared, runtime),
        join(OUT, file),
        item.key
      )
      if (fit.shrunk.length) shrunk.push(`${item.key}: ${fit.shrunk.join(' ')}`)
      const alt = altFor(item)
      altGuard(item.key, alt)
      altGuard(item.key, p(item.headline))
      manifest.set(item.key, { files: [file], alt })
    } else {
      const slides = slidesFor(item)
      const files = []
      for (const [index, slide] of slides.entries()) {
        const file = `${item.key}-${index + 1}.png`
        const { fit } = await renderStill(
          page,
          T.page({ size: T.IMAGE, ...slide.spec }, shared, runtime),
          join(OUT, file),
          `${item.key}#${index + 1}`
        )
        if (fit.shrunk.length) shrunk.push(`${item.key}#${index + 1}: ${fit.shrunk.join(' ')}`)
        altGuard(item.key, slide.alt)
        files.push(file)
      }
      manifest.set(item.key, { files, alts: slides.map(slide => slide.alt) })
    }
    process.stdout.write('.')
  })
  console.log(`\nrender-media: ${stills.length} images and carousels rendered`)

  const clips = skipVideo ? [] : items.filter(item => item.kind === 'video' && chosen(item))
  await pool(browser, T.VIDEO, clips, 3, async (page, video) => {
    const started = Date.now()
    const result = await renderVideo(page, video, shared, runtime)
    altGuard(video.key, result.alt)
    altGuard(video.key, video.headline)
    manifest.set(video.key, { files: [result.file], poster: result.poster, alt: result.alt })
    console.log(`render-media: ${result.file} in ${((Date.now() - started) / 1000).toFixed(0)}s`)
  })
  await browser.close()

  // The manifest lists every item, in library order. An item this run skipped
  // keeps what the last run wrote for it, so a partial run never drops one.
  const entries = []
  for (const item of items) {
    const made = manifest.get(item.key) ?? before.get(item.key)
    if (!made) {
      console.warn(
        `render-media: ${item.key} has never been rendered and is left out of the manifest`
      )
      continue
    }
    const size = item.kind === 'video' ? T.VIDEO : T.IMAGE
    entries.push({
      key: item.key,
      kind: item.kind,
      format: item.format,
      files: made.files,
      ...(item.kind === 'video' ? { poster: made.poster } : {}),
      width: size.width,
      height: size.height,
      ...(item.kind === 'carousel' ? { alts: made.alts } : { alt: made.alt }),
      to: item.to,
      channels: item.channels,
      headline: p(item.headline),
    })
  }
  for (const entry of entries) {
    for (const file of [...entry.files, ...(entry.poster ? [entry.poster] : [])]) {
      if (!existsSync(join(OUT, file)))
        throw new Error(`render-media: ${entry.key} names ${file}, which is not in ${OUT}`)
    }
  }
  for (const entry of entries) {
    for (const text of [entry.headline, ...(entry.alts ?? [entry.alt])]) altGuard(entry.key, text)
  }
  writeFileSync(MANIFEST, `${JSON.stringify(entries, null, 2)}\n`)
  // The repo is held to Prettier, and its JSON layout is not JSON.stringify's.
  const formatted = spawnSync(
    join(ROOT, 'node_modules', '.bin', 'prettier'),
    ['--write', MANIFEST],
    {
      stdio: 'inherit',
    }
  )
  if (formatted.status !== 0)
    throw new Error('render-media: prettier could not format the manifest')

  if (!only && !skipVideo) {
    const named = new Set(
      entries.flatMap(entry => [...entry.files, ...(entry.poster ? [entry.poster] : [])])
    )
    for (const file of readdirSync(OUT)) {
      if (!named.has(file)) {
        rmSync(join(OUT, file))
        console.log(`render-media: removed ${file}, which no item names any more`)
      }
    }
  }

  const count = kind => entries.filter(entry => entry.kind === kind).length
  console.log(
    `render-media: manifest has ${count('image')} images, ${count('carousel')} carousels, ${count('video')} videos`
  )
  if (shrunk.length)
    console.log(`render-media: type stepped down to fit on\n  ${shrunk.join('\n  ')}`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
