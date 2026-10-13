/**
 * Holds the Speed Check's filmstrip to the load it claims to show.
 *
 * The strip is the one part of the reading a visitor believes without being
 * told to: a run of frames that stays white for two seconds needs no score
 * beside it. That is what makes a wrong one expensive. A mark on the wrong
 * frame tells somebody their page was usable while it was still blank, a frame
 * dropped out of the middle is a second of white that never happened, and a
 * strip marked by the worked-out phone figure lands past the last frame on any
 * page slow enough to be worth showing. None of it fails visibly; the page
 * draws a confident picture of the wrong thing.
 *
 * So the strip is checked where it is decided: what is read out of a report,
 * what is stored and under which name, which frame is marked and by which
 * clock, and that the reading the page already drew keeps every field it had
 * with the strip beside them. The visitor's half is checked too, because a
 * reading that cannot say which post it came off is a reading nobody can count.
 *
 *   npm run check:speed-filmstrip
 */

import path from 'node:path'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  filmstripFor,
  frameSize,
  frameTime,
  framesOf,
  keepFilmstrip,
} from '../../lib/speed-check/filmstrip.js'
import { readingFor } from '../../lib/speed-check/reading.js'
import { cases, check, finish, quietly, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The page's data module imports the way the bundler resolves, by alias and
// without an extension, neither of which Node does on its own.
const ALIASES = { '@utils': 'src/app/utils' }

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = Object.keys(ALIASES).find(key => specifier.startsWith(`${key}/`))
    if (alias) {
      const target = path.join(ROOT, ALIASES[alias] + specifier.slice(alias.length))
      return nextResolve(pathToFileURL(`${target}.js`).href, context)
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.js`, context)
    }
    return nextResolve(specifier, context)
  },
})

// Nothing here may reach the network. An unstubbed path would otherwise sit on
// a real request until it timed out and pass for the wrong reason.
const OFFLINE = () => {
  throw new Error('a check reached the network')
}
globalThis.fetch = OFFLINE

/**
 * The smallest file a reader takes for a JPEG of a given size: the start
 * marker, a JFIF header, the frame header that carries the dimensions, and the
 * end marker. `fill` changes the bytes after it so two frames can differ.
 */
function jpeg(width, height, fill = 0) {
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0,
  ])
  const sof = Buffer.from([
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ])
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app0,
    sof,
    Buffer.from([0xff, 0xd9]),
    Buffer.alloc(8, fill),
  ])
}

const asData = bytes => `data:image/jpeg;base64,${bytes.toString('base64')}`

// A white screen, a half-drawn one and a finished one, the way a report stamps
// them: the white one twice, because a page that sits white for a second gives
// the same capture for every frame of it.
const WHITE = jpeg(250, 498, 1)
const HALF = jpeg(250, 498, 2)
const DONE = jpeg(250, 498, 3)

/**
 * A report shaped like the API's own, with the frames out of order the way
 * nothing promises they are not, and the observed timings beside the
 * worked-out ones.
 */
function report({ items, observed } = {}) {
  return {
    lighthouseResult: {
      audits: {
        'screenshot-thumbnails': {
          details: {
            type: 'filmstrip',
            items: items ?? [
              { timing: 1220, data: asData(WHITE) },
              { timing: 610, data: asData(WHITE) },
              { timing: 1830, data: asData(HALF) },
              { timing: 2440, data: asData(DONE) },
            ],
          },
        },
        metrics: {
          details: {
            items: [
              observed ?? {
                observedFirstContentfulPaint: 1500,
                observedLargestContentfulPaint: 2100,
                observedSpeedIndex: 1900,
                largestContentfulPaint: 24674,
              },
            ],
          },
        },
      },
    },
  }
}

/** A storage client that keeps every upload and can be made to refuse or fall over. */
function storage({ refuse = false, raise = false } = {}) {
  const uploads = []
  const db = {
    storage: {
      from(bucket) {
        return {
          async upload(name, bytes, options) {
            if (raise) throw new Error('the client is gone')
            uploads.push({ bucket, name, bytes, options })
            return { data: { path: name }, error: refuse ? { message: 'denied' } : null }
          },
          getPublicUrl(name) {
            return { data: { publicUrl: `https://cdn.example/${bucket}/${name}` } }
          },
        }
      },
    },
  }
  return { db, uploads }
}

// -- What a report holds -------------------------------------------------------

check('the frames are read in the order they were taken', () => {
  const strip = framesOf(report())
  same(strip.frames.map(frame => frame.at).join(','), '610,1220,1830,2440', 'times')
  same(strip.frames[2].bytes.equals(HALF), true, 'the half-drawn frame is the third')
  same(strip.frames[0].type, 'image/jpeg', 'kind')
})

check('the mark is the observed time, on the clock the frames were taken on', () => {
  // The worked-out figure is 24.7 seconds against a strip that ends at 2.4. A
  // mark placed by it would sit past the last frame, on a page the frames show
  // finished a long time before.
  const strip = framesOf(report())
  same(strip.usable, 2100, 'usable')
  same(strip.usable_by, 'largest_contentful_paint', 'marked by')
  same(strip.painted, 1500, 'painted')
})

check('a report with no Largest Contentful Paint is marked by its Speed Index', () => {
  const strip = framesOf(report({ observed: { observedSpeedIndex: 1900 } }))
  same(strip.usable, 1900, 'usable')
  same(strip.usable_by, 'speed_index', 'marked by')
  same(strip.painted, null, 'painted')
})

check('a report that named no moment at all keeps its frames and marks nothing', () => {
  const strip = framesOf(report({ observed: {} }))
  same(strip.frames.length, 4, 'frames')
  same(strip.usable, null, 'usable')
  same(strip.usable_by, null, 'marked by')
})

check('a frame that is not a picture the bucket takes is left out', () => {
  const strip = framesOf(
    report({
      items: [
        { timing: 300, data: asData(WHITE) },
        { timing: 600, data: 'data:image/svg+xml;base64,PHN2Zy8+' },
        { timing: 900, data: 'https://example.com/frame.jpg' },
        { timing: -5, data: asData(DONE) },
        {
          timing: 1200,
          data: `data:image/jpeg;base64,${Buffer.alloc(600_000).toString('base64')}`,
        },
        { timing: 1500, data: asData(DONE) },
      ],
    })
  )
  same(strip.frames.map(frame => frame.at).join(','), '300,1500', 'frames kept')
})

check('a report with no frames is no strip', () => {
  same(framesOf({}), null, 'an empty report')
  same(framesOf(null), null, 'no report')
  same(framesOf(report({ items: [] })), null, 'no frames')
  same(framesOf(report({ items: [{ timing: 300, data: 'nothing' }] })), null, 'no usable frame')
})

check('a frame is measured off its own header', () => {
  same(JSON.stringify(frameSize(WHITE, 'image/jpeg')), '{"width":250,"height":498}', 'jpeg')
  const png = Buffer.alloc(24)
  png.write('IHDR', 12, 'ascii')
  png.writeUInt32BE(412, 16)
  png.writeUInt32BE(823, 20)
  same(JSON.stringify(frameSize(png, 'image/png')), '{"width":412,"height":823}', 'png')
  same(frameSize(Buffer.from('not a picture'), 'image/jpeg'), null, 'something else')
  same(frameSize(null, 'image/jpeg'), null, 'nothing')
})

// -- What is stored ------------------------------------------------------------

check('a frame is stored once however many times the load showed it', async () => {
  const { db, uploads } = storage()
  const kept = await keepFilmstrip(db, framesOf(report()))
  // Four frames, three pictures: the white screen twice is one object.
  same(uploads.length, 3, 'uploads')
  same(kept.frames.length, 4, 'frames on the row')
  same(kept.frames[0].src, kept.frames[1].src, 'the two white frames share one address')
  same(kept.frames[2].src === kept.frames[3].src, false, 'two different frames do not')
  for (const upload of uploads) {
    same(upload.bucket, 'outreach-shots', 'bucket')
    same(/^frames\/[0-9a-f]{40}\.jpg$/.test(upload.name), true, `named by contents: ${upload.name}`)
    same(upload.options.contentType, 'image/jpeg', 'kind')
    same(upload.options.upsert, true, 'a frame already stored is the same object')
  }
})

check('the row keeps the times, the addresses and the marks, never the pictures', async () => {
  const { db } = storage()
  const kept = await keepFilmstrip(db, framesOf(report()))
  same(kept.frames.map(frame => frame.at).join(','), '610,1220,1830,2440', 'times')
  same(kept.frames[0].src.startsWith('https://cdn.example/outreach-shots/frames/'), true, 'address')
  same(kept.width, 250, 'width')
  same(kept.height, 498, 'height')
  same(kept.painted, 1500, 'painted')
  same(kept.usable, 2100, 'usable')
  same(kept.usable_by, 'largest_contentful_paint', 'marked by')
  same(JSON.stringify(kept).includes('base64'), false, 'a picture on the row')
})

check('a refused frame leaves the whole strip out', async () => {
  // A strip with a frame missing from the middle is a load that skipped a
  // second it did not skip.
  const { db } = storage({ refuse: true })
  same(await quietly(() => keepFilmstrip(db, framesOf(report()))), null, 'refused')
})

check('a storage client that falls over costs the strip and raises nothing', async () => {
  const { db } = storage({ raise: true })
  same(await quietly(() => keepFilmstrip(db, framesOf(report()))), null, 'fell over')
  same(await keepFilmstrip(null, framesOf(report())), null, 'no client')
  same(await keepFilmstrip(storage().db, null), null, 'no strip')
})

// -- What the page is handed ---------------------------------------------------

/** A stored strip and the reading's own metrics, as the row holds them. */
async function stored(observed) {
  const { db } = storage()
  return keepFilmstrip(db, framesOf(report({ observed })))
}

const METRICS = {
  largest_contentful_paint: { numeric: 24674, display: '24.7 s' },
  speed_index: { numeric: 24599, display: '24.6 s' },
}

check('the first frame at or after the usable moment is the one marked', async () => {
  const strip = filmstripFor(await stored(), METRICS)
  same(strip.frames.map(frame => frame.marked).join(','), 'false,false,false,true', 'marked')
  same(strip.mark, 'largest_contentful_paint', 'marked by')
})

check('each frame says what it shows', async () => {
  const strip = filmstripFor(await stored(), METRICS)
  // White before the first paint, half drawn until the main content, and
  // usable from the marked frame on.
  same(strip.frames.map(frame => frame.phase).join(','), 'blank,blank,painting,usable', 'phases')
})

check('the phone figure beside the strip is the one the reading already quotes', async () => {
  same(filmstripFor(await stored(), METRICS).phoneAt, '24.7 s', 'by the main content')
  const bySpeed = filmstripFor(await stored({ observedSpeedIndex: 1900 }), METRICS)
  same(bySpeed.phoneAt, '24.6 s', 'by the speed index')
  same(filmstripFor(await stored(), {}).phoneAt, null, 'with no metrics to quote')
})

check(
  'a strip with no usable moment claims nothing about the frames after the first paint',
  async () => {
    const strip = filmstripFor(await stored({ observedFirstContentfulPaint: 1500 }), METRICS)
    same(strip.mark, null, 'marked by')
    same(strip.phoneAt, null, 'phone figure')
    same(
      strip.frames.some(frame => frame.marked),
      false,
      'a marked frame'
    )
    same(strip.frames.map(frame => frame.phase).join(','), 'blank,blank,painted,painted', 'phases')
  }
)

check('a time on the strip is written the way the report writes its own', () => {
  same(frameTime(592), '0.6 s', 'under a second')
  same(frameTime(9759), '9.8 s', 'most of ten')
  same(frameTime(0), '0.0 s', 'the start')
})

check('a row with no strip hands the page no strip', () => {
  same(filmstripFor(null), null, 'nothing stored')
  same(filmstripFor({ frames: [] }), null, 'no frames')
  same(filmstripFor({ frames: [{ at: 'soon', src: 1 }] }), null, 'no frame worth drawing')
})

check('the reading carries the strip and every field it carried without one', async () => {
  const row = {
    site: 'https://www.example.com/',
    host: 'www.example.com',
    score: 29,
    accessibility_score: 88,
    best_practices_score: 96,
    seo_score: 92,
    audit_raw: { metrics: METRICS, opportunities: [] },
    shot_url: 'https://cdn.example/outreach-shots/shot.png',
    filmstrip: await stored(),
    created_at: '2026-10-13T16:00:00.000Z',
  }
  const reading = readingFor(row)
  // The fields the page drew before the strip existed, every one still there
  // under the same name. A consumer of the stream that ignores the strip reads
  // the same answer it always read.
  const drawn = [
    'site',
    'host',
    'score',
    'band',
    'verdict',
    'goodFloor',
    'categories',
    'short',
    'metrics',
    'opportunities',
    'shot',
    'measuredAt',
    'verify',
  ]
  for (const field of drawn) same(field in reading, true, `the reading still carries ${field}`)
  same(reading.filmstrip.frames.length, 4, 'frames')
  same(reading.filmstrip.frames[3].marked, true, 'the marked frame')
  same(readingFor({ ...row, filmstrip: null }).filmstrip, null, 'a row with no strip')
})

// -- What the endpoint does with it --------------------------------------------

check('the endpoint stores the frames beside the capture and keeps them on the row', () => {
  const text = read('api/speed-check.js')
  same(text.includes('keepFilmstrip(db, framesOf(report))'), true, 'the frames are stored')
  same(/Promise\.all\(\[\s*ensureShot\(/.test(text), true, 'beside the capture, not after it')
  same(/shot_url: shot,\s*filmstrip,/.test(text), true, 'the strip is written to the row')
})

check('a reading reused from an earlier one carries that one strip', () => {
  const text = read('api/speed-check.js')
  same(/\.select\(\s*'[^']*\bfilmstrip'/.test(text), true, 'the earlier strip is read')
  same(text.includes('filmstrip: fresh.filmstrip'), true, 'and carried')
})

check('the reading and the lead both file where the visit came from', () => {
  const text = read('api/speed-check.js')
  same(
    text.includes('arrivalFrom({ campaign: body.campaign, referrer: body.referrer })'),
    true,
    'the arrival is read off the body'
  )
  same(
    /campaign: arrival\.campaign,\s*referrer: arrival\.referrer,\s*\}\s*const \{ data: row/.test(
      text
    ),
    true,
    'the opened row carries it'
  )
  const lead = text.slice(
    text.indexOf('await keepLead('),
    text.indexOf('db\n  )', text.indexOf('await keepLead('))
  )
  same(lead.includes('campaign: arrival.campaign'), true, 'the lead carries the campaign')
  same(lead.includes('referrer: arrival.referrer'), true, 'the lead carries the referrer')
})

// -- What the page sends -------------------------------------------------------

/** A store that answers like `localStorage`. */
function store() {
  const held = new Map()
  return {
    getItem: key => (held.has(key) ? held.get(key) : null),
    setItem: (key, value) => held.set(key, value),
  }
}

/** A streamed answer, a line at a time, the way the endpoint writes one. */
function streamed(lines) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`))
      controller.close()
    },
  })
}

const POST_SEARCH = '?utm_source=fb&utm_medium=social&utm_campaign=speed-check-week-42'

check('a check run off a post sends the post with the address', async () => {
  const sent = []
  const { rememberCampaign } = await import('../../src/app/data/leads/campaign.js')
  globalThis.localStorage = store()
  globalThis.location = { pathname: '/speed-check', search: POST_SEARCH, host: 'www.taylorurl.com' }
  globalThis.document = { referrer: 'https://m.facebook.com/' }
  rememberCampaign(POST_SEARCH, { store: globalThis.localStorage })
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) })
    return {
      ok: true,
      body: streamed([
        { stage: 'measuring' },
        { result: { host: 'www.example.com', filmstrip: null } },
      ]),
    }
  }
  try {
    const { runSpeedCheck } = await import('../../src/app/data/leads/speedCheck.js')
    const stages = []
    const reading = await runSpeedCheck(
      { site: ' example.com ', email: ' owner@example.com ' },
      { onStage: stage => stages.push(stage) }
    )
    same(sent[0].url, '/api/speed-check', 'endpoint')
    same(sent[0].body.site, 'example.com', 'site')
    same(sent[0].body.campaign.utm_source, 'fb', 'source')
    same(sent[0].body.campaign.utm_campaign, 'speed-check-week-42', 'campaign')
    same(sent[0].body.referrer, 'https://m.facebook.com/', 'referrer')
    same(stages.join(','), 'measuring', 'stages')
    same(reading.host, 'www.example.com', 'the reading is the last line, as it always was')
  } finally {
    globalThis.fetch = OFFLINE
    delete globalThis.document
  }
})

check('a check typed in by hand sends no campaign and no page', async () => {
  const sent = []
  globalThis.localStorage = store()
  globalThis.location = { pathname: '/speed-check', search: '', host: 'www.taylorurl.com' }
  globalThis.document = { referrer: 'https://www.taylorurl.com/tools' }
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body))
    return { ok: true, body: streamed([{ result: { host: 'www.example.com' } }]) }
  }
  try {
    const { runSpeedCheck } = await import('../../src/app/data/leads/speedCheck.js')
    await runSpeedCheck({ site: 'example.com', email: 'owner@example.com' })
    same(sent[0].campaign, null, 'campaign')
    // One page of this site pointing at the next says nothing about where the
    // visit came from.
    same(sent[0].referrer, '', 'referrer')
  } finally {
    globalThis.fetch = OFFLINE
    delete globalThis.document
  }
})

// -- What the visitor sees ------------------------------------------------------

check('the strip is drawn from the reading, with every frame described by its time', () => {
  const page = read('src/app/views/tools/SpeedCheck.jsx')
  same(page.includes('<Filmstrip strip={reading.filmstrip}'), true, 'the page draws the strip')
  same(page.includes('{reading.filmstrip && '), true, 'and leaves it out where there is none')
  same(page.includes('alt={frameAlt(frame, strip.mark)}'), true, 'each frame has its description')
  same(
    /aria-hidden="true"[\s\S]{0,400}\{frame\.time\}/.test(page),
    true,
    'the time is not read twice'
  )
  same(page.includes('loading="lazy"'), true, 'frames load as they come into view')
})

await finish()

console.log(
  `speed filmstrip: all ${cases.length} cases pass; frames are stored once each, the strip is ` +
    'marked on its own clock, and a reading off a post files the post'
)
