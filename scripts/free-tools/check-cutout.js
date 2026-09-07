/**
 * The two libraries behind the logo cleaner.
 *
 * The cutout is checked against the cases that separate a usable result from
 * the naive one: a wordmark on white, a badge with white lettering inside it
 * that must survive, an antialiased edge that must not leave a grey fringe, and
 * a logo already transparent that must come through untouched.
 *
 * The archive is checked by reading its own table of contents back and by
 * taking the checksums again, because a zip that is one byte wrong opens
 * nowhere and says nothing about why.
 */
import {
  backgroundOf,
  coverage,
  cutout,
  flatten,
  monochrome,
  trim,
} from '../../src/app/tools/lib/cutout.js'
import { crc32, zip } from '../../src/app/tools/lib/zip.js'

let failures = 0
const check = (ok, said) => {
  if (!ok) {
    failures += 1
    console.error(`  FAIL ${said}`)
  }
}

/** A blank canvas of one colour. */
function canvas(width, height, [r, g, b], a = 255) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let at = 0; at < data.length; at += 4) {
    data[at] = r
    data[at + 1] = g
    data[at + 2] = b
    data[at + 3] = a
  }
  return { data, width, height }
}

const put = (image, x, y, [r, g, b], a = 255) => {
  const at = (y * image.width + x) * 4
  image.data[at] = r
  image.data[at + 1] = g
  image.data[at + 2] = b
  image.data[at + 3] = a
}
const alphaAt = (image, x, y) => image.data[(y * image.width + x) * 4 + 3]
const colourAt = (image, x, y) => {
  const at = (y * image.width + x) * 4
  return [image.data[at], image.data[at + 1], image.data[at + 2]]
}

const WHITE = [255, 255, 255]
const BLACK = [0, 0, 0]
const NAVY = [16, 32, 96]

// A wordmark: black marks on a white page.
const wordmark = canvas(40, 20, WHITE)
for (let x = 8; x < 32; x += 1) put(wordmark, x, 10, BLACK)

check(
  backgroundOf(wordmark).every(c => c > 240),
  `the ground under a wordmark read as ${backgroundOf(wordmark)}`
)
// Every channel has to survive as a byte. The bins are rounded, so white lands
// in the last of them and came back as 256, which is not a colour.
for (const ground of [WHITE, BLACK, NAVY, [254, 1, 128]]) {
  const read = backgroundOf(canvas(12, 12, ground))
  check(
    read.every(c => Number.isInteger(c) && c >= 0 && c <= 255),
    `a ground of ${ground} was read back as ${read}, which is outside a byte`
  )
}

const lifted = cutout(wordmark, { reach: 'everywhere' })
check(alphaAt(lifted, 0, 0) === 0, 'the page around a wordmark was kept')
check(alphaAt(lifted, 20, 10) === 255, 'the ink of a wordmark was removed')

// A badge: a navy disc with a white letter inside it, on a white page. The
// letter has to survive, which is the case a plain colour key cannot answer.
const badge = canvas(40, 40, WHITE)
for (let y = 0; y < 40; y += 1) {
  for (let x = 0; x < 40; x += 1) {
    if ((x - 20) ** 2 + (y - 20) ** 2 < 200) put(badge, x, y, NAVY)
  }
}
for (let x = 17; x < 23; x += 1) put(badge, x, 20, WHITE)

const outside = cutout(badge, { reach: 'outside' })
check(alphaAt(outside, 0, 0) === 0, 'the page around a badge was kept')
check(alphaAt(outside, 20, 20) === 255, 'the white lettering inside a badge was removed')
check(alphaAt(outside, 20, 12) === 255, 'the body of a badge was removed')

const everywhere = cutout(badge, { reach: 'everywhere' })
check(alphaAt(everywhere, 0, 0) === 0, 'the page around a badge survived the wider reach')
check(
  alphaAt(everywhere, 20, 20) === 0,
  'the wider reach kept the inside lettering, so the two reaches do the same thing'
)

// An antialiased edge: half ink, half paper. It has to come out half opaque
// and its colour has to come back to the ink, not to the grey it looks.
const edge = canvas(3, 1, WHITE)
put(edge, 1, 0, [128, 128, 128])
put(edge, 2, 0, BLACK)
const unmixed = cutout(edge, { reach: 'everywhere', tolerance: 0.02, softness: 0.9 })
const mid = alphaAt(unmixed, 1, 0)
check(mid > 60 && mid < 200, `a half-covered pixel came out at alpha ${mid}`)
check(
  colourAt(unmixed, 1, 0).every(c => c < 90),
  `a half-covered pixel kept the paper in it and came out ${colourAt(unmixed, 1, 0)}`
)

const haloed = cutout(edge, { reach: 'everywhere', tolerance: 0.02, softness: 0.9, unmix: false })
check(
  colourAt(haloed, 1, 0)[0] > colourAt(unmixed, 1, 0)[0],
  'taking the ground back out made no difference to the edge'
)

// Artwork that is already transparent is not touched.
const already = canvas(10, 10, NAVY, 0)
for (let x = 3; x < 7; x += 1) put(already, x, 5, NAVY, 255)
const untouched = cutout(already, { reach: 'outside' })
check(alphaAt(untouched, 5, 5) === 255, 'a transparent file lost its artwork')

// The variants keep the cover and change only what they are meant to.
const mono = monochrome(outside, BLACK)
check(alphaAt(mono, 20, 12) === alphaAt(outside, 20, 12), 'a mono variant lost the cover')
check(
  colourAt(mono, 20, 12).every(c => c === 0),
  'a black variant is not black'
)
const white = monochrome(outside, WHITE)
check(
  colourAt(white, 20, 12).every(c => c === 255),
  'a white variant is not white'
)

const flat = flatten(outside, WHITE)
check(alphaAt(flat, 0, 0) === 255, 'a flattened image kept transparency')
check(
  colourAt(flat, 0, 0).every(c => c === 255),
  'a flattened background is not the colour asked for'
)

// Trimming takes the margin off and leaves the artwork whole.
const margined = canvas(30, 30, WHITE, 0)
for (let y = 12; y < 18; y += 1) for (let x = 10; x < 20; x += 1) put(margined, x, y, BLACK)
const tight = trim(margined)
check(
  tight.width === 10 && tight.height === 6,
  `trimmed to ${tight.width}x${tight.height}, expected 10x6`
)
check(alphaAt(tight, 0, 0) === 255, 'trimming cut into the artwork')
check(trim(canvas(5, 5, WHITE, 0)).width === 5, 'trimming an empty image changed its size')

check(
  coverage(outside) > 0.1 && coverage(outside) < 0.9,
  `a badge covered ${coverage(outside)} of its frame`
)
check(
  coverage(cutout(canvas(10, 10, WHITE), { reach: 'everywhere' })) === 0,
  'a blank page kept something'
)

// The archive: read its own trailer back and check every stored entry.
const files = [
  { name: 'logo.png', bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]) },
  { name: 'on-dark/logo-white.png', bytes: new Uint8Array(300).fill(7) },
  { name: 'readme.txt', bytes: new TextEncoder().encode('what is in this folder') },
]
const archive = zip(files, new Date('2026-08-29T12:34:56Z'))
const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)

check(view.getUint32(0, true) === 0x04034b50, 'the archive does not start with a file record')
const endAt = archive.length - 22
check(view.getUint32(endAt, true) === 0x06054b50, 'the archive does not end with its trailer')
check(
  view.getUint16(endAt + 10, true) === files.length,
  'the trailer counts the wrong number of files'
)
const directoryAt = view.getUint32(endAt + 16, true)
check(
  view.getUint32(directoryAt, true) === 0x02014b50,
  'the table of contents is not where the trailer says'
)
check(
  view.getUint32(endAt + 12, true) === endAt - directoryAt,
  'the table of contents is not the length the trailer claims'
)

// Every entry's name, length and checksum, read back out of its own record.
let at = 0
for (const file of files) {
  check(view.getUint32(at, true) === 0x04034b50, `no record where ${file.name} should start`)
  const nameLength = view.getUint16(at + 26, true)
  const name = new TextDecoder().decode(archive.subarray(at + 30, at + 30 + nameLength))
  check(name === file.name, `record named ${name}, expected ${file.name}`)
  check(
    view.getUint32(at + 18, true) === file.bytes.length,
    `${file.name} records the wrong length`
  )
  check(
    view.getUint32(at + 14, true) === crc32(file.bytes),
    `${file.name} carries the wrong checksum`
  )
  const body = archive.subarray(at + 30 + nameLength, at + 30 + nameLength + file.bytes.length)
  check(
    body.every((byte, i) => byte === file.bytes[i]),
    `${file.name} came back different`
  )
  at += 30 + nameLength + file.bytes.length
}
check(at === directoryAt, 'the file records do not end where the table of contents begins')

// A checksum against a value the format is known by.
check(
  crc32(new TextEncoder().encode('123456789')) === 0xcbf43926,
  'CRC-32 is wrong on the standard check value'
)

if (failures) {
  console.error(`cutout: ${failures} checks failed`)
  process.exit(1)
}
console.log(
  'cutout: wordmark, badge, antialiased edge and transparent art all handled; archive reads back whole'
)
