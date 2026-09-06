/**
 * The QR encoder, held to grids that are known to be right.
 *
 * The expected values below were taken from this encoder only after its output
 * had been compared module for module against qrencode across every version
 * and every correction level, so they record a verified state rather than
 * whatever the code happened to do the day they were written. A change that
 * moves any of them has changed what a printed code says, which is a thing
 * nobody finds out about until the flyers are back from the printer.
 *
 * The sizes matter as much as the digests: version, mask and byte count moving
 * says which of the four stages drifted, where a digest alone says only that
 * something did.
 */
import { encodeQr, maximumBytes } from '../src/app/tools/lib/qr.js'
import { qrSvg } from '../src/app/tools/lib/qrRender.js'

const EXPECTED = [
  {
    text: 'https://www.taylorurl.com',
    level: 'M',
    version: 2,
    size: 25,
    mask: 2,
    bytes: 25,
    digest: '37dcf470c553e406',
  },
  { text: 'A', level: 'L', version: 1, size: 21, mask: 0, bytes: 1, digest: '95c3dabec2cfbab8' },
  {
    text: 'tel:+15551234567',
    level: 'Q',
    version: 2,
    size: 25,
    mask: 7,
    bytes: 16,
    digest: 'a6db69cceb8d964a',
  },
  {
    text: 'WIFI:T:WPA;S:Shop Guest;P:hunter2hunter2;;',
    level: 'H',
    version: 5,
    size: 37,
    mask: 0,
    bytes: 42,
    digest: 'c840caea79fe5f58',
  },
  {
    text: 'x'.repeat(300),
    level: 'M',
    version: 13,
    size: 69,
    mask: 0,
    bytes: 300,
    digest: '97ab92507eba9624',
  },
]

// The published byte capacities at version 40, which every capacity figure in
// the encoder is derived from.
const CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 }

function digestOf(grid) {
  let hash = 0n
  for (let row = 0; row < grid.size; row += 1) {
    for (let column = 0; column < grid.size; column += 1) {
      hash = (hash * 31n + BigInt(grid.modules[row][column] ? 1 : 0)) % 2n ** 64n
    }
  }
  return hash.toString(16)
}

let failures = 0
const check = (ok, said) => {
  if (!ok) {
    failures += 1
    console.error(`  FAIL ${said}`)
  }
}

for (const expected of EXPECTED) {
  const grid = encodeQr(expected.text, { level: expected.level })
  const name = `${expected.level} ${expected.bytes}B`
  check(
    grid.version === expected.version,
    `${name}: version ${grid.version}, expected ${expected.version}`
  )
  check(grid.size === expected.size, `${name}: size ${grid.size}, expected ${expected.size}`)
  check(grid.mask === expected.mask, `${name}: mask ${grid.mask}, expected ${expected.mask}`)
  check(grid.bytes === expected.bytes, `${name}: ${grid.bytes} bytes, expected ${expected.bytes}`)
  check(digestOf(grid) === expected.digest, `${name}: the grid itself has changed`)
}

for (const [level, capacity] of Object.entries(CAPACITY)) {
  check(
    maximumBytes(level) === capacity,
    `level ${level} holds ${maximumBytes(level)}, expected ${capacity}`
  )
}

// A payload past the largest version is refused rather than silently truncated.
let refused = false
try {
  encodeQr('x'.repeat(3000), { level: 'H' })
} catch {
  refused = true
}
check(refused, 'an oversized payload was encoded rather than refused')

// The drawing carries a module per dark square and the quiet zone around them.
const drawn = encodeQr('https://www.taylorurl.com', { level: 'M' })
const svg = qrSvg(drawn, { scale: 4 })
check(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'the SVG is not a standalone document')
check(
  svg.includes(`viewBox="0 0 ${drawn.size + 8} ${drawn.size + 8}"`),
  'the SVG lost its quiet zone'
)

if (failures) {
  console.error(`qr: ${failures} checks failed`)
  process.exit(1)
}
console.log(`qr: ${EXPECTED.length} grids match their verified values, capacities and refusal hold`)
