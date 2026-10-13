/**
 * The browser a card is drawn in, and the sheet every card is drawn on.
 *
 * Shared by `render-media.js`, which renders the library on a workstation, and
 * `generated-cards.js`, which renders review and proof cards on the Pi. Both
 * open the same Chromium the same way, embed the same two faces, mask the same
 * wordmark and settle every page through the same fit and the same guard, so a
 * card drawn from a review this morning sits beside one drawn from an article
 * last month as one set rather than as a near copy.
 *
 * Chromium is whatever `PLAYWRIGHT_CHROMIUM` names, else the newest one
 * Playwright has cached, else `/usr/bin/chromium-browser` (the Pi).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { guard } from './media-guard.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

export function findChromium() {
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

/** The browser every card is drawn in, launched the way the library was drawn. */
export function launch() {
  return chromium.launch({
    executablePath: findChromium(),
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  })
}

export function fontFaces() {
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
export async function wordmark(browser) {
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

/**
 * What every page is drawn with, read once per run: the faces, the chassis, the
 * mark, and the runtime that fits the type and seeks a video.
 *
 * @param {object} browser From `launch`.
 * @returns {Promise<{shared: object, runtime: string}>}
 */
export async function sheet(browser) {
  return {
    shared: {
      fontFaces: fontFaces(),
      css: readFileSync(join(HERE, 'media-templates', 'sheet.css'), 'utf8'),
      mark: await wordmark(browser),
    },
    runtime: readFileSync(join(HERE, 'media-templates', 'runtime.js'), 'utf8'),
  }
}

/**
 * A page made ready to photograph, or refused.
 *
 * The faces have to have loaded, the type has to fit its box at or above its
 * floor, and the text the page actually shows - read back after layout, not the
 * copy it was handed - has to pass every guard.
 */
export async function settle(page, key) {
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

/**
 * One still: the page laid out, settled, and photographed.
 *
 * @param {object} page A Playwright page sized to the card.
 * @param {string} html The whole page, from `templates.page`.
 * @param {string|null} path Where the PNG is written, or null to keep it in memory.
 * @param {string} key What a refusal names.
 * @returns {Promise<{fit: object, png: Buffer}>}
 */
export async function renderStill(page, html, path, key) {
  await page.setContent(html, { waitUntil: 'load' })
  const fit = await settle(page, key)
  const png = await page.screenshot({ ...(path ? { path } : {}), type: 'png' })
  return { fit, png }
}
