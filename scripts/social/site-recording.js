/**
 * A client's site, opened on an emulated phone and recorded as it loads.
 *
 * The launch video shows the new site the way a customer first meets it: on a
 * mid-range phone, over a 4G connection, from a blank screen to the settled
 * page and a slow scroll down it. This is the recording; what is done with it
 * is `lib/social/launches.js` and the `launch` template.
 *
 * THE PHONE. 390 by 844, touch and a mobile viewport, drawn at one and a half
 * times the density, which is a little over the 500 pixels across the video
 * shows the page at, and a phone's user agent, so a site that serves phones
 * something different serves it here.
 *
 * THE CONNECTION. The one Lighthouse grades a phone over, "Slow 4G": 150 ms
 * round trips, 1.6 Mbps down and 750 Kbps up. DevTools throttles each request
 * rather than each packet, so it is applied the way Lighthouse applies it
 * through DevTools - 562.5 ms of latency on every request and nine tenths of
 * each throughput. A site PageSpeed grades over that connection is filmed over
 * the same one.
 *
 * THE PROCESSOR. Lighthouse slows a desktop processor fourfold to stand for a
 * mid-range phone, and a workstation is a desktop. The Pi's Cortex-A76 runs
 * single-threaded script at about half a desktop's pace, so the Pi slows itself
 * twofold to stand for the same phone. Neither is a measurement of a handset;
 * both are the convention the readings on the studio's own pages are taken by.
 *
 * WHAT IS RECORDED. Every frame Chromium paints during the load, with the
 * moment it painted, from the screencast rather than from screenshots taken on
 * a timer: a screenshot taken mid-load costs the page the time it takes, and a
 * load filmed that way is slower than the load it films. Once the page has
 * settled the throttling comes off and the scroll is photographed one step at
 * a time, because a scroll is the page standing still at a series of places
 * and is the same at any speed.
 *
 * WHAT IS NOT. The studio's own visitor tracker is refused, so filming a
 * client's site never counts as a visit in the figures the client reads.
 */

/** The phone's screen, in CSS pixels. */
export const PHONE = { width: 390, height: 844 }

/**
 * How densely the page is drawn. Every picture of it rides into the video page
 * as data, so a density the video cannot show is weight the Pi carries for
 * nothing.
 */
export const DENSITY = 1.5

/** Lighthouse's "Slow 4G", as DevTools throttling applies it. Kbps are kilobits. */
export const SLOW_4G = { latencyMs: 562.5, downloadKbps: 1474.56, uploadKbps: 675 }

/** How many times slower the processor runs to stand for a mid-range phone. */
export const cpuSlowdown = (platform = process.platform, arch = process.arch) =>
  platform === 'linux' && arch === 'arm64' ? 2 : 4

/** Requests that are the studio's tracker, refused while a site is filmed. */
const TRACKER = /\.supabase\.co\/functions\/v1\/analytics/

/** The longest a site gets to load before the recording is called a failure. */
const LOAD_TIMEOUT_MS = 45_000

/** How long the page is left after its load event, for the last images to land. */
const SETTLE_MS = 1_200

/** How many steps the scroll is photographed in: four seconds at thirty frames. */
const SCROLL_STEPS = 120

/** How far the scroll travels at most, in screens. */
const SCROLL_SCREENS = 1.6

const KBPS = 1024 / 8

/** A phone's user agent, carrying this browser's own version. */
const agentFor = version =>
  `Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version.split('.')[0]}.0.0.0 Mobile Safari/537.36`

/** What the loaded page offers a customer, read off its markup. */
function readFacts() {
  const links = [...document.querySelectorAll('a[href]')]
    .map(link => `${link.getAttribute('href')} ${link.textContent}`.replace(/\s+/g, ' '))
    .map(text => text.trim().toLowerCase())
    .slice(0, 400)
  return {
    tel: Boolean(document.querySelector('a[href^="tel:"]')),
    sms: Boolean(document.querySelector('a[href^="sms:"]')),
    form: Boolean(document.querySelector('form input:not([type="hidden"]), form textarea')),
    links,
  }
}

/**
 * Opens a page on the phone and answers what it offers, without filming it.
 *
 * What an anonymous launch reads: the lines on its card are held to the page
 * the same way a named launch's are, and nothing of the page is kept.
 *
 * @param {object} browser From `media-sheet.launch`.
 * @param {string} url The site.
 * @returns {Promise<{tel: boolean, sms: boolean, form: boolean, links: string[]}>}
 */
export async function readSite(browser, url) {
  const context = await browser.newContext(phoneContext(browser))
  try {
    await context.route(TRACKER, route => route.abort())
    const page = await context.newPage()
    const response = await page.goto(url, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS })
    if (!response || !response.ok()) {
      throw new Error(`${url} answered ${response ? response.status() : 'nothing'}`)
    }
    return await page.evaluate(readFacts)
  } finally {
    await context.close()
  }
}

function phoneContext(browser) {
  return {
    viewport: PHONE,
    screen: PHONE,
    deviceScaleFactor: DENSITY,
    isMobile: true,
    hasTouch: true,
    userAgent: agentFor(browser.version()),
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    colorScheme: 'light',
    serviceWorkers: 'block',
  }
}

/**
 * Films a site loading on the phone, then scrolling.
 *
 * @param {object} browser From `media-sheet.launch`.
 * @param {string} url The site.
 * @param {object} [options]
 * @param {number} [options.cpu] The processor slowdown, `cpuSlowdown()` by default.
 * @returns {Promise<{url: string, host: string, load: {at: number, jpeg: Buffer}[],
 *   painted: number|null, loaded: number, scroll: Buffer[], shot: Buffer,
 *   facts: object}>} `at`, `painted` and `loaded` are seconds from the navigation.
 */
export async function recordSite(browser, url, { cpu = cpuSlowdown() } = {}) {
  const context = await browser.newContext(phoneContext(browser))
  try {
    await context.route(TRACKER, route => route.abort())
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

    await page.goto('about:blank')
    const painted = []
    cdp.on('Page.screencastFrame', frame => {
      painted.push({ stamp: frame.metadata.timestamp, data: frame.data })
      cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => null)
    })

    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: SLOW_4G.latencyMs,
      downloadThroughput: SLOW_4G.downloadKbps * KBPS,
      uploadThroughput: SLOW_4G.uploadKbps * KBPS,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 82,
      maxWidth: PHONE.width * DENSITY,
      maxHeight: PHONE.height * DENSITY,
      everyNthFrame: 1,
    })

    // The screencast stamps each frame in seconds since the epoch, on the same
    // clock as this one, so the navigation's own start is the zero of the film.
    const started = Date.now() / 1000
    const response = await page.goto(url, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS })
    if (!response || !response.ok()) {
      throw new Error(`${url} answered ${response ? response.status() : 'nothing'}`)
    }
    const loaded = Date.now() / 1000 - started
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => null)
    await page.waitForTimeout(SETTLE_MS)
    await cdp.send('Page.stopScreencast')

    const firstPaint = await page.evaluate(
      () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
    )

    // Off for the scroll and the facts: what is filmed from here is the page
    // standing at a series of places, which is the same at any speed.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })

    const facts = await page.evaluate(readFacts)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    const shot = await page.screenshot({ type: 'jpeg', quality: 90 })

    const travel = await page.evaluate(
      screens =>
        Math.max(
          0,
          Math.min(
            document.scrollingElement.scrollHeight - window.innerHeight,
            window.innerHeight * screens
          )
        ),
      SCROLL_SCREENS
    )
    const scroll = []
    if (travel > 40) {
      for (let step = 0; step < SCROLL_STEPS; step += 1) {
        const p = step / (SCROLL_STEPS - 1)
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
        await page.evaluate(
          top =>
            new Promise(resolve => {
              window.scrollTo({ top, behavior: 'instant' })
              requestAnimationFrame(() => requestAnimationFrame(resolve))
            }),
          Math.round(travel * eased)
        )
        scroll.push(await page.screenshot({ type: 'jpeg', quality: 82 }))
      }
    }

    const load = painted
      .map(frame => ({ at: frame.stamp - started, jpeg: Buffer.from(frame.data, 'base64') }))
      .filter(frame => frame.at >= -0.05)
      .map(frame => ({ ...frame, at: Math.max(0, frame.at) }))
      .sort((a, b) => a.at - b.at)
    if (!load.length) throw new Error(`${url} painted nothing while it loaded`)

    return {
      url: page.url(),
      host: new URL(page.url()).hostname.replace(/^www\./, ''),
      load,
      painted: firstPaint === null ? null : firstPaint / 1000,
      loaded,
      scroll,
      shot,
      facts,
    }
  } finally {
    await context.close()
  }
}
