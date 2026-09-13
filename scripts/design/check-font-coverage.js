/**
 * That the two faces still cover every character the site can set.
 *
 * The files under public/fonts are subsets - scripts/design/subset-fonts.py cuts the
 * upstream Geist builds down to the ranges this site uses, which is where half
 * the weight on the critical path went. The saving is real and so is the risk
 * that comes with it: a subset is a font with holes in it, and a character that
 * falls in one renders as a blank box. Nothing in a build catches that. The
 * page compiles, the tests pass, and a reader sees tofu in a heading.
 *
 * So the guarantee is made here instead of assumed. Every non-ASCII character
 * written anywhere the browser can reach - the components, the copy, the data
 * modules, the document - is read back out of the source tree on every run and
 * looked up in both fonts. A curly apostrophe typed into a new headline, a
 * middle dot in a new separator, an accent in a name added to the reviews:
 * each one either has a glyph in both files or fails here, naming itself and
 * the line it was written on.
 *
 * The ranges the subset carries beyond what the tree spells are checked too,
 * because most of the text on this site is not in the repository at all. Client
 * names, town names and review bodies arrive from the database at runtime, and
 * an accented surname is exactly the character nobody would think to look for.
 * Those ranges are the standing insurance against it, so a re-subset that drops
 * one fails here rather than on somebody's name.
 *
 * The variable axis and the layout features are checked last. The stylesheet
 * sets six weights off one file per family and turns on two stylistic sets, and
 * the figures throughout the site are tabular; a subset that flattened the axis
 * or dropped those features would still render every character and still be
 * wrong.
 *
 *     npm run check:font-coverage
 */
import { brotliDecompressSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { expect as check, finish } from '../harness/checks.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/*
 * The table tags a WOFF2 directory refers to by index rather than by name, in
 * the order the format numbers them. An entry flagged 63 spells its tag out
 * instead, which is the escape hatch for anything not on this list.
 */
const KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
]

/** A WOFF2 length, written seven bits to the byte, high bit meaning more. */
function base128(buf, at) {
  let value = 0
  for (let step = 0; step < 5; step += 1) {
    const byte = buf[at + step]
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return [value, at + step + 1]
  }
  throw new Error('a table length ran past five bytes')
}

/**
 * The tables of a WOFF2 file, each as a slice of the decompressed stream.
 *
 * Only the directory is read from the container; the payload behind it is one
 * brotli stream holding every table end to end, so a table is found by adding
 * up the lengths of the ones the directory lists before it. A transformed table
 * occupies its transformed length there rather than its original one, which is
 * what makes glyf and loca land in the right place.
 */
function woff2Tables(file) {
  const buf = readFileSync(file)
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${file} is not WOFF2`)
  const numTables = buf.readUInt16BE(12)

  let at = 48
  const directory = []
  for (let entry = 0; entry < numTables; entry += 1) {
    const flags = buf[at]
    at += 1
    const index = flags & 0x3f
    let tag
    if (index === 63) {
      tag = buf.toString('latin1', at, at + 4)
      at += 4
    } else {
      tag = KNOWN_TAGS[index]
    }
    let originalLength
    ;[originalLength, at] = base128(buf, at)

    const version = (flags >> 6) & 0x03
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    let length = originalLength
    if (transformed) [length, at] = base128(buf, at)

    directory.push({ tag, length })
  }

  const stream = brotliDecompressSync(buf.subarray(at))
  const tables = new Map()
  let offset = 0
  for (const { tag, length } of directory) {
    tables.set(tag, stream.subarray(offset, offset + length))
    offset += length
  }
  return tables
}

/** Every codepoint a cmap maps to a glyph, read off its Unicode subtables. */
function mappedCodepoints(cmap) {
  const found = new Set()
  const numTables = cmap.readUInt16BE(2)
  for (let record = 0; record < numTables; record += 1) {
    const base = 4 + record * 8
    const platform = cmap.readUInt16BE(base)
    const encoding = cmap.readUInt16BE(base + 2)
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))
    if (!unicode) continue

    const table = cmap.subarray(cmap.readUInt32BE(base + 4))
    const format = table.readUInt16BE(0)

    if (format === 4) {
      const segments = table.readUInt16BE(6) / 2
      const ends = 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const rangeOffsets = deltas + segments * 2
      for (let seg = 0; seg < segments; seg += 1) {
        const end = table.readUInt16BE(ends + seg * 2)
        const start = table.readUInt16BE(starts + seg * 2)
        if (start === 0xffff) continue
        const delta = table.readInt16BE(deltas + seg * 2)
        const rangeOffset = table.readUInt16BE(rangeOffsets + seg * 2)
        for (let cp = start; cp <= end; cp += 1) {
          let glyph
          if (rangeOffset === 0) {
            glyph = (cp + delta) & 0xffff
          } else {
            const at = rangeOffsets + seg * 2 + rangeOffset + (cp - start) * 2
            if (at + 1 >= table.length) continue
            glyph = table.readUInt16BE(at)
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff
          }
          if (glyph !== 0) found.add(cp)
        }
      }
    } else if (format === 12) {
      const groups = table.readUInt32BE(12)
      for (let group = 0; group < groups; group += 1) {
        const at = 16 + group * 12
        const start = table.readUInt32BE(at)
        const end = table.readUInt32BE(at + 4)
        for (let cp = start; cp <= end; cp += 1) found.add(cp)
      }
    }
  }
  return found
}

/** The OpenType feature tags a layout table declares. */
function featureTags(table) {
  if (!table) return new Set()
  const featureListOffset = table.readUInt16BE(6)
  const count = table.readUInt16BE(featureListOffset)
  const tags = new Set()
  for (let record = 0; record < count; record += 1) {
    tags.add(
      table.toString(
        'latin1',
        featureListOffset + 2 + record * 6,
        featureListOffset + 6 + record * 6
      )
    )
  }
  return tags
}

/*
 * Where the browser can be handed a character. Everything under src is either
 * shipped markup, shipped copy or a data module the views read; the document
 * carries the shell around them. What lives outside these is build tooling and
 * server code, whose output is mail and JSON rather than a line set in Geist.
 */
const SOURCE_DIRS = ['src']
const SOURCE_FILES = ['index.html']
const TEXT = /\.(jsx?|tsx?|css|html|json|md|svg)$/

function sourceFiles() {
  const found = [...SOURCE_FILES.map(file => path.join(ROOT, file))]
  const walk = dir => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (TEXT.test(entry)) found.push(full)
    }
  }
  SOURCE_DIRS.forEach(dir => walk(path.join(ROOT, dir)))
  return found
}

/*
 * A comment is not copy. The box-drawing rules that head the sections of a
 * stylesheet and the dashes inside a docblock never reach a browser, and
 * holding the fonts to them would carry a hundred and sixty glyphs of box
 * drawing for the sake of a comment.
 */
const stripComments = (text, file) =>
  file.endsWith('.css')
    ? text.replace(/\/\*[\s\S]*?\*\//g, ' ')
    : text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/** Every non-ASCII character the source tree can put in front of a reader. */
function writtenCharacters() {
  const found = new Map()
  for (const file of sourceFiles()) {
    const text = stripComments(readFileSync(file, 'utf8'), file)
    text.split('\n').forEach((line, index) => {
      for (const character of line) {
        const cp = character.codePointAt(0)
        if (cp > 0x7e && !found.has(cp)) {
          found.set(cp, `${path.relative(ROOT, file)}:${index + 1}`)
        }
      }
    })
  }
  return found
}

/*
 * The ranges the subset carries whether or not the repository spells them.
 * Most of the words on this site arrive from the database, so the accented
 * letters, the punctuation and the currency marks are held as whole blocks
 * rather than as the handful of characters written down today.
 *
 * Each row names what the upstream builds actually draw in that block, which is
 * not the same as the block being full - Geist has no glyph for a soft hyphen
 * and stops short of a few Latin Extended-A letters. Counting against what the
 * upstream has is what makes this catch a range the subset dropped instead of
 * failing every run over letters that were never drawn.
 */
const INSURED = [
  [0x0020, 0x007e, 'Basic Latin', 95, 95],
  [0x00a0, 0x00ff, 'Latin-1 Supplement', 95, 95],
  [0x0100, 0x017f, 'Latin Extended-A', 117, 115],
  [0x0300, 0x036f, 'Combining Diacritical Marks', 22, 22],
  [0x2000, 0x206f, 'General Punctuation', 20, 20],
  [0x2070, 0x209f, 'Superscripts and Subscripts', 17, 17],
  [0x20a0, 0x20bf, 'Currency Symbols', 6, 6],
  [0x2190, 0x21ff, 'Arrows', 21, 21],
]

/*
 * Characters the upstream builds never had. Each already sets in whatever the
 * fallback stack reaches, and listing them here is what stops a later reader
 * from taking their absence for something the subset did.
 */
const ABSENT_UPSTREAM = new Set([0x2318, 0x202f, 0x2060, 0x200b])

const FACES = [
  ['public/fonts/geist-variable.woff2', 'Geist'],
  ['public/fonts/geist-mono-variable.woff2', 'Geist Mono'],
]

const written = writtenCharacters()
const show = cp => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

let checkedCharacters = 0
let insuredCovered = 0
const sizes = []

FACES.forEach(([file, family], face) => {
  const full = path.join(ROOT, file)
  const tables = woff2Tables(full)
  const covered = mappedCodepoints(tables.get('cmap'))
  sizes.push([family, statSync(full).size, covered.size])

  for (const [cp, where] of written) {
    if (ABSENT_UPSTREAM.has(cp)) continue
    check(
      covered.has(cp),
      `${family} has no glyph for ${show(cp)} ${JSON.stringify(String.fromCodePoint(cp))}, written at ${where}`
    )
  }

  for (const block of INSURED) {
    const [start, end, name] = block
    const expected = block[3 + face]
    let held = 0
    for (let cp = start; cp <= end; cp += 1) if (covered.has(cp)) held += 1
    check(
      held >= expected,
      `${family} draws ${held} of ${name}, down from the ${expected} the upstream build has`
    )
    if (face === 0) insuredCovered += expected
  }

  const fvar = tables.get('fvar')
  check(Boolean(fvar), `${family} lost its fvar table, so it is no longer variable`)
  if (fvar) {
    const axesArrayOffset = fvar.readUInt16BE(4)
    const axisCount = fvar.readUInt16BE(8)
    const tag = fvar.toString('latin1', axesArrayOffset, axesArrayOffset + 4)
    const min = fvar.readInt32BE(axesArrayOffset + 4) / 65536
    const max = fvar.readInt32BE(axesArrayOffset + 12) / 65536
    check(axisCount >= 1 && tag === 'wght', `${family} no longer varies on weight`)
    check(min <= 100 && max >= 900, `${family} varies on weight only from ${min} to ${max}`)
    check(Boolean(tables.get('gvar')), `${family} lost gvar, so its weight axis moves nothing`)
  }

  const gsub = featureTags(tables.get('GSUB'))
  for (const feature of ['ss01', 'ss02']) {
    check(gsub.has(feature), `${family} lost ${feature}, which the stylesheet turns on`)
  }
})

checkedCharacters = written.size

/*
 * Tabular figures are asked for throughout the site. The proportional face
 * carries them as a feature; the monospaced one sets every figure on the same
 * advance by construction and ships no tnum at all, so it is the sans that has
 * something to lose here.
 */
const sansGsub = featureTags(woff2Tables(path.join(ROOT, FACES[0][0])).get('GSUB'))
check(sansGsub.has('tnum'), 'Geist lost tnum, so tabular-nums no longer aligns a column of figures')

/*
 * A ceiling rather than a target. The point is to catch a re-subset that
 * quietly wrote the upstream build back over the top, which is the one failure
 * that leaves every character in place and still costs the page its first paint.
 */
for (const [family, size] of sizes) {
  check(size < 48_000, `${family} is ${size} bytes, which is not a subset`)
}

await finish()

console.log(
  `font-coverage: ${checkedCharacters} characters written across the source tree and ${insuredCovered} ` +
    `carried as insurance all have glyphs in both faces; ` +
    sizes
      .map(([family, size, mapped]) => `${family} ${size} bytes over ${mapped} codepoints`)
      .join(', ') +
    `; both keep a 100-900 weight axis with gvar, ss01 and ss02, and the sans keeps tnum.`
)
