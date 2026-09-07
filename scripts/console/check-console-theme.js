/**
 * Proves that the console reads in both palettes, on every one of its tabs.
 *
 * The console carries its own light and dark palettes on the `console` scope,
 * and everything drawn inside that scope is meant to take its colour through
 * them. A section that names a colour of its own is drawn once and then stops
 * answering the reader's setting: it is correct in the palette it was written
 * against and wrong in the other, and nothing else in the app will say so. That
 * is what this scan catches - a hex, an rgb(), or one of the framework's own
 * palette classes anywhere in the console's own files.
 *
 * The second half is the part CSS cannot reach at all. A tick box, a dropped
 * select list, the spinners on a number, the calendar a datetime-local opens
 * and every scrollbar in here are drawn by the browser, and a variable never
 * touches them: they follow the scheme the element declares, and an element
 * that declares none is drawn light on a near-black card. So both palettes
 * have to name one, and the three portals the console opens on the body - the
 * search, the shortcut sheet and the modals - have to carry the scope with
 * them, or what they open lands outside the palette it belongs to.
 *
 * Two colours are fixed on purpose and named here rather than found. A letter
 * preview and a two-factor code are not console furniture: one is mail written
 * for an inbox and the other is read by a camera, and both stay on white paper
 * whatever the reader has chosen.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

// Everything drawn inside the console scope. The status board and the charts
// are outside the console's own directory but only ever render within it, so
// a colour named in either lands on the console's ground.
const SCANNED = ['src/app/views/console', 'src/app/views/status', 'src/app/views/analytics']

// Where the console's two palettes are written, and where its own layer is.
const PALETTES = 'src/index.css'
const LAYER = 'src/app/views/console/console.css'

// The rules that fix a colour on purpose, each with what is being served by
// fixing it. A rule outside this list may not name a colour at all.
const FIXED = {
  '.console-letter': 'mail written for an inbox, previewed as it will arrive',
  '.console-qr': 'a code read by a camera rather than by the reader',
}

const cases = []
const check = (name, run) => cases.push([name, run])
const same = (got, want, what) => {
  if (got !== want) {
    throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
  }
}

function sources(dir) {
  const found = []
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, entry)
    if (statSync(join(ROOT, rel)).isDirectory()) found.push(...sources(rel))
    else if (/\.(jsx?|css)$/.test(entry)) found.push(rel)
  }
  return found
}

const FILES = SCANNED.flatMap(sources)

// A colour written down rather than read from the palette. Hexes and the
// functional notations are the direct form; the framework's palette classes are
// the same statement spelled as a utility, and `white` and `black` are the two
// that read as neutral and are neither.
const LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:bg|text|border|fill|stroke|ring|divide|decoration|outline|from|via|to|accent|caret|placeholder)-(?:white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/

// A line inside one of the fixed rules, which is allowed its colour. The rules
// are short, so the block each opens is followed to its closing brace.
function fixedLines(css) {
  const inside = new Set()
  for (const selector of Object.keys(FIXED)) {
    let at = css.indexOf(`${selector} {`)
    while (at !== -1) {
      const close = css.indexOf('}', at)
      const first = css.slice(0, at).split('\n').length
      const last = css.slice(0, close).split('\n').length
      for (let line = first; line <= last; line += 1) inside.add(line)
      at = css.indexOf(`${selector} {`, close)
    }
  }
  return inside
}

check('no console file names a colour of its own', () => {
  const named = []
  for (const file of FILES) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    const allowed = file.endsWith('.css') ? fixedLines(text) : new Set()
    text.split('\n').forEach((line, index) => {
      if (allowed.has(index + 1)) return
      // A comment is prose about a colour, not a colour.
      const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*\*.*$/, '')
      if (LITERAL.test(code)) named.push(`${file}:${index + 1}  ${line.trim()}`)
    })
  }
  same(named.join('\n'), '', `colours named outside the palette\n${named.join('\n')}\n`)
})

check('every colour fixed on purpose is one of the two that are meant to be', () => {
  const css = readFileSync(join(ROOT, LAYER), 'utf8')
  for (const [selector, why] of Object.entries(FIXED)) {
    same(css.includes(`${selector} {`), true, `${selector} is still drawn (${why})`)
  }
})

check('both palettes tell the browser which scheme it is drawing into', () => {
  const css = readFileSync(join(ROOT, PALETTES), 'utf8')
  const light = css.slice(css.indexOf("[data-theme='console'] {"))
  same(/^[^}]*color-scheme:\s*light/s.test(light), true, 'the light palette declares color-scheme')
  const dark = css.slice(css.indexOf(":root[data-theme='dark'] [data-theme='console'] {"))
  same(/^[^}]*color-scheme:\s*dark/s.test(dark), true, 'the dark palette declares color-scheme')
})

/*
 * The palettes themselves, measured rather than looked at.
 *
 * This is the half that was missed the first time. Every colour in the console
 * is a token and every token has two values, so a scan for a hex finds nothing
 * wrong and the console still reads in one setting and not the other: the two
 * values were picked to look right on their own ground, and only one of them
 * was ever held against a contrast floor.
 *
 * That is exactly what happened to the greys. The dark ramp was cut against
 * its ground - the palette's own note records the faint step at 4.49 on the
 * rail - and so were the status hues and the chart series on the light ground.
 * The light greys were not, and faint landed at 3.15 on a white card against
 * 4.65 for the same step on the dark one. It is baked into the table head, the
 * quiet button and every field's placeholder, so the same column heading was
 * legible on one setting and not on the other, on all sixteen tabs.
 *
 * So the floors are asserted on both settings at once. A step that clears one
 * and not the other is not a palette with a dark mode, it is two palettes of
 * which one was checked.
 */

// The colour a channel is drawn at, once alpha over its ground is worked out.
function paint(value, ground) {
  const parse = text => {
    const solid = /^#([0-9a-f]{6})$/i.exec(text)
    if (solid) {
      const n = parseInt(solid[1], 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
    }
    const fn = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.%]+))?\s*\)/i.exec(
      text
    )
    if (!fn) return null
    const raw = fn[4]
    const alpha =
      raw === undefined ? 1 : raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw)
    return [+fn[1], +fn[2], +fn[3], alpha]
  }
  const fore = parse(value)
  const back = parse(ground)
  if (!fore || !back) return null
  return fore.slice(0, 3).map((channel, i) => channel * fore[3] + back[i] * (1 - fore[3]))
}

function contrast(value, ground) {
  const over = paint(value, ground)
  const under = paint(ground, ground)
  if (!over || !under) return null
  const light = rgb => {
    const parts = rgb.map(channel => {
      const unit = channel / 255
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]
  }
  const [high, low] = [light(over), light(under)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

// The declaration bodies of the four blocks the console resolves through, and
// the two readings they compose into. The light block carries no theme of its
// own, so it applies on both settings and the dark block layers over it.
function palettes() {
  const text = readFileSync(join(ROOT, PALETTES), 'utf8')
  const body = selector => {
    const at = text.indexOf(selector + ' {')
    if (at === -1) throw new Error(`no block for ${selector}`)
    let i = text.indexOf('{', at) + 1
    let depth = 1
    const from = i
    while (depth > 0) {
      const ch = text[i]
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      i += 1
    }
    return text.slice(from, i - 1)
  }
  const read = source => {
    const found = new Map()
    for (const hit of source.replace(/\{[^{}]*\}/g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
      found.set(hit[1], hit[2].trim())
    return found
  }
  const root = read(body(':root'))
  const rootDark = read(body(":root[data-theme='dark']"))
  const conLight = read(body("[data-theme='console']"))
  const conDark = read(body(":root[data-theme='dark'] [data-theme='console']"))
  return {
    light: new Map([...root, ...conLight]),
    dark: new Map([...root, ...rootDark, ...conLight, ...conDark]),
  }
}

function value(map, name) {
  let held = map.get(name)
  let guard = 0
  while (held && /var\(/.test(held) && guard++ < 12) {
    held = held.replace(
      /var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g,
      (_, ref, fallback) => map.get(ref) ?? fallback ?? ''
    )
  }
  return (held || '').trim()
}

// What each channel owes, and on which of the console's grounds. Text takes
// 4.5; a dot, a segment and anything else read as a shape rather than as words
// takes 3.
const GROUNDS = ['--console-card-bg', '--console-rail-bg', '--paper-field']
const FLOORS = [
  ['--paper-ink', 4.5, 'body copy'],
  ['--paper-ink-soft', 4.5, 'secondary copy'],
  ['--paper-ink-mute', 4.5, 'captions and quiet copy'],
  ['--paper-ink-faint', 4.5, 'the table head, the quiet button, every placeholder'],
  ['--good', 4.5, 'a passing run, as words'],
  ['--warn', 4.5, 'a warning, as words'],
  ['--danger', 4.5, 'a failure, as words'],
  ['--accent', 4.5, 'a link in a card'],
  ['--good-fill', 3, 'a state dot'],
  ['--warn-fill', 3, 'a state dot'],
  ['--danger-fill', 3, 'a state dot'],
  ['--series-1', 3, 'a chart segment'],
  ['--series-2', 3, 'a chart segment'],
  ['--series-3', 3, 'a chart segment'],
  ['--series-4', 3, 'a chart segment'],
  ['--series-5', 3, 'a chart segment'],
  ['--series-6', 3, 'a chart segment'],
  ['--series-7', 3, 'a chart segment'],
]

check('every channel clears its floor on both settings, not just on one', () => {
  const { light, dark } = palettes()
  const short = []
  for (const [name, floor, what] of FLOORS) {
    for (const [setting, map] of [
      ['light', light],
      ['dark', dark],
    ]) {
      for (const ground of GROUNDS) {
        const got = contrast(value(map, name), value(map, ground))
        if (got === null) {
          short.push(`${name} on ${ground} (${setting}): could not be read`)
        } else if (got < floor) {
          short.push(
            `${name} on ${ground} (${setting}): ${got.toFixed(2)} against a floor of ${floor} - ${what}`
          )
        }
      }
    }
  }
  same(short.join('\n'), '', `channels under their floor\n${short.join('\n')}\n`)
})

check('anything the console opens on the body carries the scope with it', () => {
  const escaped = []
  for (const file of FILES) {
    if (!file.endsWith('.jsx')) continue
    const text = readFileSync(join(ROOT, file), 'utf8')
    // The call, not the import beside it.
    const opens = text.split('createPortal(').length - 1
    if (!opens) continue
    const scoped = text.split('data-theme="console"').length - 1
    if (scoped < opens) escaped.push(`${relative('.', file)}: ${opens} opened, ${scoped} scoped`)
  }
  same(escaped.join('\n'), '', `portals drawn outside the console palette\n${escaped.join('\n')}\n`)
})

const failures = []
for (const [name, run] of cases) {
  try {
    run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const line of failures) console.error(line)
  console.error(`console theme: ${failures.length} of ${cases.length} cases failed`)
  process.exit(1)
}

console.log(`console theme: all ${cases.length} cases pass across ${FILES.length} files`)
