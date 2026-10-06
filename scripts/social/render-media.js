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
 * the browser after layout and checked for client names, prices, first-person
 * voice and emoji; copy that does not fit its box at its smallest permitted
 * size fails the run instead of shipping clipped; and every `to` must be a page
 * this build prerenders.
 *
 * Chromium is whatever `PLAYWRIGHT_CHROMIUM` names, else the newest one
 * Playwright has cached, else `/usr/bin/chromium-browser` (the Pi).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { PRERENDER_ROUTES } from '../../vite/site-routes.js'
import * as T from './media-templates/templates.js'
import { library } from './media-content.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(ROOT, 'public', 'social', 'library')
const MANIFEST = join(ROOT, 'lib', 'social', 'library.json')
const FPS = 30
const MAX_VIDEO_BYTES = 4 * 1024 * 1024

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const only = option('--only')?.split(',').filter(Boolean) ?? null
const skipVideo = flag('--skip-video')
const copyOut = option('--copy')

// ---------------------------------------------------------------------------
// Chromium and ffmpeg
// ---------------------------------------------------------------------------

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
  ].filter(dir => dir && existsSync(dir))
  const binaries = [
    'chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chrome-headless-shell-mac-x64/chrome-headless-shell',
    'chrome-headless-shell-linux64/chrome-headless-shell',
    'chrome-headless-shell-linux-arm64/chrome-headless-shell',
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
  ]
  for (const cache of caches) {
    const builds = readdirSync(cache)
      .filter(name => /^chromium(_headless_shell)?-\d+$/.test(name))
      .sort(
        (a, b) =>
          Number(b.split('-').pop()) - Number(a.split('-').pop()) ||
          (a.includes('headless') ? -1 : 1)
      )
    for (const build of builds) {
      for (const binary of binaries) {
        const path = join(cache, build, binary)
        if (existsSync(path)) return path
      }
    }
  }
  if (existsSync('/usr/bin/chromium-browser')) return '/usr/bin/chromium-browser'
  if (existsSync('/usr/bin/chromium')) return '/usr/bin/chromium'
  throw new Error('render-media: no Chromium found. Set PLAYWRIGHT_CHROMIUM to a chrome binary.')
}

const FFMPEG = process.env.FFMPEG || 'ffmpeg'

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Every way a client could be named in a line of copy: the business name, its
 * first word and first two words, the host it is served from and the host's
 * stem. The first word is matched as a whole word and in its own case, so
 * "Compound" the business is caught and "compound" the adjective would not be.
 * The extra names are ones the articles print beside a client: a parent company
 * and an owner's first name.
 */
function clientPatterns() {
  const terms = new Set(['SRM', 'Angie', 'go-kart', 'TX-146'])
  const loose = new Set()
  for (const project of PORTFOLIO_PROJECTS.filter(entry => entry.kind === 'client')) {
    const parts = project.name.split(/\s+/)
    terms.add(project.name)
    terms.add(parts[0])
    if (parts.length > 1) terms.add(parts.slice(0, 2).join(' '))
    const host = project.displayUrl.replace(/^www\./, '')
    loose.add(host)
    loose.add(host.split('.')[0])
  }
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    ...[...terms].map(term => ({
      term,
      re: new RegExp(`(^|[^A-Za-z0-9])${escape(term)}(?![A-Za-z0-9])`),
    })),
    ...[...loose].map(term => ({ term, re: new RegExp(escape(term), 'i') })),
  ]
}

const CLIENTS = clientPatterns()
const RULES = [
  { why: 'a price', re: /\$\s?\d|\b\d[\d,]*\s?dollars?\b|\bstarting at\b|\bfrom \$|\bUSD\b/i },
  { why: 'first-person voice', re: /(^|[^A-Za-z-])(I|I'm|I've|I'll|I'd)(?![A-Za-z'’-])/ },
  { why: 'first-person voice', re: /\b(me|my|mine|myself)\b/i },
  { why: 'solo framing', re: /\bone[- ]person\b|\bsolo\b/i },
  { why: 'an emoji', re: /\p{Extended_Pictographic}/u },
  { why: 'an em dash', re: /—/ },
  { why: 'a value that never resolved', re: /\b(undefined|null|NaN)\b/ },
]

/** Spacing and punctuation an alt built from parts can come out with. */
const ALT_RULES = [
  { why: 'a space before punctuation', re: /\s[.,;:?!]/ },
  { why: 'a doubled stop', re: /[.?!]\./ },
  { why: 'a stop inside a sentence', re: /\d%\.\s+[a-z]/ },
]

function guard(key, text) {
  const faults = []
  for (const { term, re } of CLIENTS) if (re.test(text)) faults.push(`client name "${term}"`)
  for (const { why, re } of RULES)
    if (re.test(text)) faults.push(`${why} (${text.match(re)[0].trim()})`)
  if (faults.length)
    throw new Error(`render-media: ${key} carries ${faults.join(', ')}:\n  ${text.slice(0, 400)}`)
}

/** An alt or a headline: every guard above, plus the ones a joined string can fail. */
function altGuard(key, text) {
  guard(key, text)
  const faults = ALT_RULES.filter(({ re }) => re.test(text)).map(
    ({ why, re }) => `${why} ("${text.match(re)[0]}")`
  )
  if (faults.length)
    throw new Error(`render-media: ${key} alt has ${faults.join(', ')}:\n  ${text.slice(0, 400)}`)
}

const ROUTES = new Set(
  PRERENDER_ROUTES.map(route => (typeof route === 'string' ? route : route.path))
)

// ---------------------------------------------------------------------------
// Shared page assets
// ---------------------------------------------------------------------------

function fontFaces() {
  const face = (family, file) =>
    `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${readFileSync(join(ROOT, 'public', 'fonts', file)).toString('base64')}) format('woff2'); font-weight: 100 900; font-style: normal; font-display: block; }`
  return [
    face('Geist', 'geist-variable.woff2'),
    face('Geist Mono', 'geist-mono-variable.woff2'),
  ].join('\n')
}

/**
 * The wordmark, cropped to its ink and turned into a mask.
 *
 * The shipped PNG sits in a square that is mostly empty and carries a coloured
 * halo, so it is thresholded and cropped the way `brand/social/src/tulib.py`
 * does it, and only the alpha is kept: the mark is then drawn in whatever the
 * accent is on that sheet. `base` is where the baseline falls in the crop, so
 * the mark sits on the same line as the address beside it.
 */
async function wordmark(browser) {
  const page = await browser.newPage()
  const png = readFileSync(join(ROOT, 'public', 'images', 'TaylorURL-Logo.png')).toString('base64')
  const result = await page.evaluate(async source => {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height)
    let x0 = canvas.width
    let y0 = canvas.height
    let x1 = 0
    let y1 = 0
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4
        const on = data.data[i + 3] >= 90
        data.data[i] = 255
        data.data[i + 1] = 255
        data.data[i + 2] = 255
        data.data[i + 3] = on ? 255 : 0
        if (on) {
          x0 = Math.min(x0, x)
          y0 = Math.min(y0, y)
          x1 = Math.max(x1, x)
          y1 = Math.max(y1, y)
        }
      }
    }
    context.putImageData(data, 0, 0)
    const width = x1 - x0 + 1
    const height = y1 - y0 + 1
    const crop = document.createElement('canvas')
    crop.width = width
    crop.height = height
    crop.getContext('2d').drawImage(canvas, x0, y0, width, height, 0, 0, width, height)
    const alpha = crop.getContext('2d').getImageData(0, 0, width, height).data
    const rows = []
    for (let y = 0; y < height; y++) {
      let count = 0
      for (let x = 0; x < width; x++) if (alpha[(y * width + x) * 4 + 3]) count++
      rows.push(count)
    }
    const floor = rows[height - 1] * 3
    let base = height - 1
    for (let y = height - 1; y > 0; y--) {
      if (rows[y] > floor) {
        base = y
        break
      }
    }
    return { url: crop.toDataURL('image/png'), aspect: width / height, base: base / height }
  }, `data:image/png;base64,${png}`)
  await page.close()
  return result
}

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

async function settle(page, key) {
  await page.evaluate(() => document.fonts.ready)
  const fonts = await page.evaluate(
    () => document.fonts.check('600 80px Geist') && document.fonts.check('500 21px "Geist Mono"')
  )
  if (!fonts) throw new Error(`render-media: ${key} rendered without Geist`)
  const fit = await page.evaluate(() => window.__fit())
  if (fit.problems.length)
    throw new Error(`render-media: ${key} does not fit:\n  ${fit.problems.join('\n  ')}`)
  guard(
    key,
    await page.evaluate(() =>
      (body => (
        body.querySelectorAll('script').forEach(script => script.remove()),
        body.textContent
      ))(document.body.cloneNode(true)).replace(/\s+/g, ' ')
    )
  )
  return fit
}

async function renderStill(page, html, file, key) {
  await page.setContent(html, { waitUntil: 'load' })
  const fit = await settle(page, key)
  await page.screenshot({ path: join(OUT, file), type: 'png' })
  return fit
}

/** Frames straight into ffmpeg: no frame ever touches the disk. */
async function renderVideo(page, video, shared, runtime) {
  const file = `${video.key}.mp4`
  const poster = `${video.key}-poster.png`
  await page.setContent(T.videoPage(video, shared, runtime), { waitUntil: 'load' })
  await settle(page, video.key)

  await page.evaluate(t => window.__seek(t), video.poster)
  await page.screenshot({ path: join(OUT, poster), type: 'png' })

  const frames = Math.round(video.duration * FPS)
  const ffmpeg = spawn(
    FFMPEG,
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-c:v',
      'mjpeg',
      '-i',
      '-',
      '-f',
      'lavfi',
      '-t',
      String(video.duration),
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-vf',
      'scale=in_range=full:out_range=limited,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-color_range',
      'tv',
      '-profile:v',
      'high',
      '-level:v',
      '4.1',
      '-r',
      String(FPS),
      '-g',
      String(FPS * 2),
      '-c:a',
      'aac',
      '-b:a',
      '48k',
      '-shortest',
      '-movflags',
      '+faststart',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:v',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      join(OUT, file),
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  )
  const done = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject)
    ffmpeg.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`render-media: ffmpeg exited ${code} on ${file}`))
    )
  })
  for (let frame = 0; frame < frames; frame++) {
    await page.evaluate(t => window.__seek(t), frame / FPS)
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 92 })
    if (!ffmpeg.stdin.write(jpeg)) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve))
  }
  ffmpeg.stdin.end()
  await done
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
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  })
  const shared = {
    fontFaces: fontFaces(),
    css: readFileSync(join(HERE, 'media-templates', 'sheet.css'), 'utf8'),
    mark: await wordmark(browser),
  }
  const runtime = readFileSync(join(HERE, 'media-templates', 'runtime.js'), 'utf8')
  const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : []
  const before = new Map(previous.map(entry => [entry.key, entry]))
  const manifest = new Map()
  const shrunk = []

  const stills = items.filter(item => item.kind !== 'video' && chosen(item))
  await pool(browser, T.IMAGE, stills, 4, async (page, item) => {
    if (item.kind === 'image') {
      const spec = TEMPLATES[item.format](item)
      const file = `${item.key}.png`
      const fit = await renderStill(
        page,
        T.page({ size: T.IMAGE, ...spec }, shared, runtime),
        file,
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
        const fit = await renderStill(
          page,
          T.page({ size: T.IMAGE, ...slide.spec }, shared, runtime),
          file,
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
