/**
 * QR encoding in byte mode, versions 1 through 40.
 *
 * A QR code is a fixed grid of light and dark modules carrying the payload
 * twice over: once as the data itself and once as Reed-Solomon parity, which
 * is what lets a scanner read a code through a fingerprint or a fold. Encoding
 * runs in four movements - the payload becomes a bitstream, the bitstream is
 * split into blocks and given parity, the blocks are interleaved and laid into
 * the grid around its fixed patterns, and one of eight masks is chosen to break
 * up the runs of one colour that would otherwise confuse a scanner.
 *
 * Byte mode alone, because everything a visitor puts in is a URL or a line of
 * text: numeric and alphanumeric modes pack denser but only for inputs made
 * entirely of digits or of a 45-character subset, and choosing between three
 * modes to save a version on some inputs is complexity nobody sees.
 */

// The primitive polynomial the specification fixes for the field, and the two
// logarithm tables that turn multiplication in it into addition.
const GF_PRIMITIVE = 0x11d
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)

for (let value = 1, power = 0; power < 255; power += 1) {
  EXP[power] = value
  LOG[value] = power
  value <<= 1
  if (value & 0x100) value ^= GF_PRIMITIVE
}
for (let power = 255; power < 512; power += 1) EXP[power] = EXP[power - 255]

/** Multiplication in GF(256). Zero has no logarithm, so it is answered first. */
function gfMultiply(a, b) {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

/**
 * The generator polynomial for `degree` parity codewords, which is the product
 * of (x - 2^i) for i below the degree. Each degree is built once and kept,
 * since a code with many blocks asks for the same one per block.
 */
const generators = new Map()

function generatorPolynomial(degree) {
  const held = generators.get(degree)
  if (held) return held

  let poly = new Uint8Array([1])
  for (let step = 0; step < degree; step += 1) {
    const next = new Uint8Array(poly.length + 1)
    for (let index = 0; index < poly.length; index += 1) {
      next[index] ^= poly[index]
      next[index + 1] ^= gfMultiply(poly[index], EXP[step])
    }
    poly = next
  }
  generators.set(degree, poly)
  return poly
}

/** The parity codewords for one block, as polynomial division's remainder. */
function parityFor(data, count) {
  const generator = generatorPolynomial(count)
  const remainder = new Uint8Array(count)

  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.copyWithin(0, 1)
    remainder[count - 1] = 0
    if (factor !== 0) {
      for (let index = 0; index < count; index += 1) {
        remainder[index] ^= gfMultiply(generator[index + 1], factor)
      }
    }
  }
  return remainder
}

// Total codewords a version holds, data and parity together. Every other
// capacity figure is derived from this one, so a version's arithmetic has a
// single source rather than four tables that can disagree.
const TOTAL_CODEWORDS = [
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876, 3034,
  3196, 3362, 3532, 3706,
]

// Parity codewords per block, and how many blocks the data is split into, both
// indexed by version and then by correction level in L, M, Q, H order. The two
// together fix how much of a version's space is left for the payload.
const PARITY_PER_BLOCK = [
  [7, 10, 13, 17],
  [10, 16, 22, 28],
  [15, 26, 18, 22],
  [20, 18, 26, 16],
  [26, 24, 18, 22],
  [18, 16, 24, 28],
  [20, 18, 18, 26],
  [24, 22, 22, 26],
  [30, 22, 20, 24],
  [18, 26, 24, 28],
  [20, 30, 28, 24],
  [24, 22, 26, 28],
  [26, 22, 24, 22],
  [30, 24, 20, 24],
  [22, 24, 30, 24],
  [24, 28, 24, 30],
  [28, 28, 28, 28],
  [30, 26, 28, 28],
  [28, 26, 26, 26],
  [28, 26, 30, 28],
  [28, 26, 28, 30],
  [28, 28, 30, 24],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [26, 28, 30, 30],
  [28, 28, 28, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
  [30, 28, 30, 30],
]

const BLOCK_COUNT = [
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 2, 2],
  [1, 2, 2, 4],
  [1, 2, 4, 4],
  [2, 4, 4, 4],
  [2, 4, 6, 5],
  [2, 4, 6, 6],
  [2, 5, 8, 8],
  [4, 5, 8, 8],
  [4, 5, 8, 11],
  [4, 8, 10, 11],
  [4, 9, 12, 16],
  [4, 9, 16, 16],
  [6, 10, 12, 18],
  [6, 10, 17, 16],
  [6, 11, 16, 19],
  [6, 13, 18, 21],
  [7, 14, 21, 25],
  [8, 16, 20, 25],
  [8, 17, 23, 25],
  [9, 17, 23, 34],
  [9, 18, 25, 30],
  [10, 20, 27, 32],
  [12, 21, 29, 35],
  [12, 23, 34, 37],
  [12, 25, 34, 40],
  [13, 26, 35, 42],
  [14, 28, 38, 45],
  [15, 29, 40, 48],
  [16, 31, 43, 51],
  [17, 33, 45, 54],
  [18, 35, 48, 57],
  [19, 37, 51, 60],
  [19, 38, 53, 63],
  [20, 40, 56, 66],
  [21, 43, 59, 70],
  [22, 45, 62, 74],
  [24, 47, 65, 77],
  [25, 49, 68, 81],
]

// Where the alignment patterns sit, as the coordinates their centres take on
// both axes. Every pairing is used except the three that would land on a
// finder pattern. Version 1 carries none.
const ALIGNMENT_CENTRES = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
]

// The correction levels, in the order the tables above index them, each with
// the two bits it takes in the format information. The bit patterns are not in
// level order, which is why they are carried here rather than derived.
export const LEVELS = [
  { id: 'L', label: 'Low', recovers: 0.07, bits: 0b01 },
  { id: 'M', label: 'Medium', recovers: 0.15, bits: 0b00 },
  { id: 'Q', label: 'Strong', recovers: 0.25, bits: 0b11 },
  { id: 'H', label: 'Strongest', recovers: 0.3, bits: 0b10 },
]

const MODE_BYTE = 0b0100

/** Data codewords a version and level leave for the payload and its header. */
function dataCodewords(version, level) {
  const index = version - 1
  return TOTAL_CODEWORDS[index] - PARITY_PER_BLOCK[index][level] * BLOCK_COUNT[index][level]
}

/**
 * How many bits the character count takes. Byte mode spends one byte on it up
 * to version 9 and two above, which is why a payload can fit a version and not
 * the one below it by more than the module count suggests.
 */
const countBits = version => (version < 10 ? 8 : 16)

/** The smallest version holding these bytes at this level, or null. */
function versionFor(byteLength, level, minVersion) {
  for (let version = Math.max(1, minVersion); version <= 40; version += 1) {
    const capacity = dataCodewords(version, level) * 8 - 4 - countBits(version)
    if (byteLength * 8 <= capacity) return version
  }
  return null
}

/** A bit sink that fills codewords most significant bit first. */
function bitWriter() {
  const bytes = []
  let pending = 0
  let filled = 0

  return {
    push(value, width) {
      for (let bit = width - 1; bit >= 0; bit -= 1) {
        pending = (pending << 1) | ((value >>> bit) & 1)
        filled += 1
        if (filled === 8) {
          bytes.push(pending)
          pending = 0
          filled = 0
        }
      }
    },
    // The remainder of a part-filled codeword is zero, which is also the
    // terminator's own padding, so both are settled by the same flush.
    finish() {
      if (filled > 0) bytes.push(pending << (8 - filled))
      return bytes
    },
  }
}

/**
 * The payload as codewords: the mode, the length, the bytes, a terminator, and
 * the alternating pad the specification names for whatever room is left.
 */
function payloadCodewords(bytes, version, level) {
  const capacity = dataCodewords(version, level)
  const writer = bitWriter()

  writer.push(MODE_BYTE, 4)
  writer.push(bytes.length, countBits(version))
  for (const byte of bytes) writer.push(byte, 8)

  const used = 4 + countBits(version) + bytes.length * 8
  writer.push(0, Math.min(4, capacity * 8 - used))

  // The pad alternates from its own first byte rather than from the payload's
  // length, so a payload ending on an odd codeword still pads 0xEC first.
  const codewords = writer.finish()
  const PAD = [0xec, 0x11]
  for (let index = 0; codewords.length < capacity; index += 1) codewords.push(PAD[index % 2])
  return codewords
}

/**
 * The codewords in the order they are laid into the grid: data blocks read a
 * column at a time, then parity blocks the same way. Interleaving is what
 * spreads a scratch across every block rather than destroying one of them.
 *
 * Blocks come in two sizes at most, and the longer ones go last, so a column
 * read that runs past the short blocks simply skips them.
 */
function interleave(codewords, version, level) {
  const index = version - 1
  const blocks = BLOCK_COUNT[index][level]
  const parityLength = PARITY_PER_BLOCK[index][level]
  const shortLength = Math.floor(codewords.length / blocks)
  const longBlocks = codewords.length % blocks

  const data = []
  const parity = []
  let read = 0
  for (let block = 0; block < blocks; block += 1) {
    const length = shortLength + (block >= blocks - longBlocks ? 1 : 0)
    const slice = codewords.slice(read, read + length)
    read += length
    data.push(slice)
    parity.push(parityFor(slice, parityLength))
  }

  const ordered = []
  for (let column = 0; column <= shortLength; column += 1) {
    for (const block of data) if (column < block.length) ordered.push(block[column])
  }
  for (let column = 0; column < parityLength; column += 1) {
    for (const block of parity) ordered.push(block[column])
  }
  return ordered
}

// A module is 0 or 1, and `reserved` marks the ones the function patterns own
// so the data placement walks past them.
function blankGrid(size) {
  return {
    size,
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    reserved: Array.from({ length: size }, () => new Uint8Array(size)),
  }
}

function setModule(grid, row, column, dark) {
  grid.modules[row][column] = dark ? 1 : 0
  grid.reserved[row][column] = 1
}

/** A finder pattern and the light separator around it, at one corner. */
function placeFinder(grid, row, column) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const atRow = row + y
      const atColumn = column + x
      if (atRow < 0 || atRow >= grid.size || atColumn < 0 || atColumn >= grid.size) continue
      const edge = Math.max(Math.abs(y - 3), Math.abs(x - 3))
      setModule(grid, atRow, atColumn, edge !== 2 && edge <= 3)
    }
  }
}

function placeAlignment(grid, row, column) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      setModule(grid, row + y, column + x, Math.max(Math.abs(y), Math.abs(x)) !== 1)
    }
  }
}

/** The fixed patterns: finders, timing, alignment, and the one dark module. */
function placeFunctionPatterns(grid, version) {
  const last = grid.size - 1

  placeFinder(grid, 0, 0)
  placeFinder(grid, 0, last - 6)
  placeFinder(grid, last - 6, 0)

  for (let along = 8; along < grid.size - 8; along += 1) {
    setModule(grid, 6, along, along % 2 === 0)
    setModule(grid, along, 6, along % 2 === 0)
  }

  const centres = ALIGNMENT_CENTRES[version - 1]
  for (const row of centres) {
    for (const column of centres) {
      const onFinder =
        (row === 6 && column === 6) ||
        (row === 6 && column === last - 6) ||
        (row === last - 6 && column === 6)
      if (!onFinder) placeAlignment(grid, row, column)
    }
  }

  setModule(grid, last - 7, 8, true)

  // The format bands are reserved before the data is laid and written after a
  // mask has been chosen, since which mask won is part of what they carry.
  for (let offset = 0; offset <= 8; offset += 1) {
    if (offset !== 6) {
      grid.reserved[8][offset] = 1
      grid.reserved[offset][8] = 1
    }
  }
  for (let offset = 0; offset < 8; offset += 1) {
    grid.reserved[8][last - offset] = 1
    grid.reserved[last - offset][8] = 1
  }

  if (version >= 7) {
    for (let bit = 0; bit < 18; bit += 1) {
      const row = Math.floor(bit / 3)
      const column = last - 10 + (bit % 3)
      grid.reserved[row][column] = 1
      grid.reserved[column][row] = 1
    }
  }
}

/** BCH remainder against a generator, used by both information bands. */
function bchRemainder(value, generator, width) {
  let remainder = value
  const generatorWidth = 32 - Math.clz32(generator)
  while (32 - Math.clz32(remainder) >= generatorWidth) {
    remainder ^= generator << (32 - Math.clz32(remainder) - generatorWidth)
  }
  return remainder & ((1 << width) - 1)
}

const FORMAT_GENERATOR = 0b101_0011_0111
const FORMAT_MASK = 0b101_0100_0001_0010
const VERSION_GENERATOR = 0b1_1111_0010_0101

function writeFormatInformation(grid, level, mask) {
  const seed = (LEVELS[level].bits << 3) | mask
  const bits = ((seed << 10) | bchRemainder(seed << 10, FORMAT_GENERATOR, 10)) ^ FORMAT_MASK
  const last = grid.size - 1

  // The band is written twice so a code damaged at one corner is still
  // readable. The copies split at different bits: the one around the top-left
  // finder turns after eight, and the one spread across the other two turns
  // after seven, because the dark module already holds the place the eighth
  // would have taken.
  for (let bit = 0; bit < 15; bit += 1) {
    // The band runs most significant bit first, so the walk below counts up
    // through the positions while the value is read down from its top bit.
    const dark = ((bits >> (14 - bit)) & 1) === 1

    const near = bit < 6 ? bit : bit < 8 ? bit + 1 : bit === 8 ? 7 : 14 - bit
    if (bit < 8) grid.modules[8][near] = dark ? 1 : 0
    else grid.modules[near][8] = dark ? 1 : 0

    if (bit < 7) grid.modules[last - bit][8] = dark ? 1 : 0
    else grid.modules[8][last - 14 + bit] = dark ? 1 : 0
  }
}

function writeVersionInformation(grid, version) {
  if (version < 7) return
  const bits = (version << 12) | bchRemainder(version << 12, VERSION_GENERATOR, 12)
  const last = grid.size - 1

  for (let bit = 0; bit < 18; bit += 1) {
    const dark = ((bits >> bit) & 1) === 1
    const row = Math.floor(bit / 3)
    const column = last - 10 + (bit % 3)
    grid.modules[row][column] = dark ? 1 : 0
    grid.modules[column][row] = dark ? 1 : 0
  }
}

/**
 * The codewords laid into whatever the function patterns left, two columns at
 * a time from the bottom right, each pair read in the opposite direction to
 * the one before it. Column six is the vertical timing line and is stepped
 * over rather than counted.
 */
function placeData(grid, codewords) {
  let bit = 0
  let upward = true

  for (let right = grid.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < grid.size; step += 1) {
      const row = upward ? grid.size - 1 - step : step
      for (const column of [right, right - 1]) {
        if (grid.reserved[row][column]) continue
        const byte = codewords[bit >> 3]
        grid.modules[row][column] = byte === undefined ? 0 : (byte >> (7 - (bit & 7))) & 1
        bit += 1
      }
    }
    upward = !upward
  }
}

// The eight masks, as the predicate deciding whether a module at a position is
// inverted. Masking exists to break up the large blocks of one colour that a
// scanner cannot lock onto.
const MASKS = [
  (row, column) => (row + column) % 2 === 0,
  row => row % 2 === 0,
  (row, column) => column % 3 === 0,
  (row, column) => (row + column) % 3 === 0,
  (row, column) => (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0,
  (row, column) => ((row * column) % 2) + ((row * column) % 3) === 0,
  (row, column) => (((row * column) % 2) + ((row * column) % 3)) % 2 === 0,
  (row, column) => (((row + column) % 2) + ((row * column) % 3)) % 2 === 0,
]

function applyMask(grid, mask) {
  const flips = MASKS[mask]
  for (let row = 0; row < grid.size; row += 1) {
    for (let column = 0; column < grid.size; column += 1) {
      if (!grid.reserved[row][column] && flips(row, column)) {
        grid.modules[row][column] ^= 1
      }
    }
  }
}

// The finder-like sequence rule three looks for, in both directions.
const FINDER_RUN = [1, 0, 1, 1, 1, 0, 1]

/**
 * How poorly a masked grid would scan, by the specification's four rules: long
 * runs of one colour, solid two-by-two blocks, sequences a scanner could take
 * for a finder pattern, and an imbalance between dark and light. The mask with
 * the lowest score is the one the code is published with.
 */
function penalty(grid) {
  const { size, modules } = grid
  let score = 0

  const line = (at, along) =>
    along === 'row' ? index => modules[at][index] : index => modules[index][at]

  for (const along of ['row', 'column']) {
    for (let at = 0; at < size; at += 1) {
      const read = line(at, along)
      let run = 1
      for (let index = 1; index < size; index += 1) {
        if (read(index) === read(index - 1)) {
          run += 1
          if (run === 5) score += 3
          else if (run > 5) score += 1
        } else {
          run = 1
        }
      }
      // Rule three counts the sequence with four light modules on either side,
      // and the grid's own edge stands in for that quiet run.
      for (let index = 0; index + 6 < size; index += 1) {
        let matches = true
        for (let offset = 0; offset < 7; offset += 1) {
          if (read(index + offset) !== FINDER_RUN[offset]) {
            matches = false
            break
          }
        }
        if (!matches) continue
        let before = 0
        for (let back = index - 1; back >= 0 && back > index - 5 && read(back) === 0; back -= 1) {
          before += 1
        }
        let after = 0
        for (let on = index + 7; on < size && on < index + 11 && read(on) === 0; on += 1) after += 1
        // Light on both sides is two of the sequences the rule names, not one,
        // so each side is counted in its own right.
        if (before === 4) score += 40
        if (after === 4) score += 40
      }
    }
  }

  for (let row = 0; row + 1 < size; row += 1) {
    for (let column = 0; column + 1 < size; column += 1) {
      const first = modules[row][column]
      if (
        first === modules[row][column + 1] &&
        first === modules[row + 1][column] &&
        first === modules[row + 1][column + 1]
      ) {
        score += 3
      }
    }
  }

  let dark = 0
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) dark += modules[row][column]
  }
  const share = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(share - 50) / 5) * 10

  return score
}

/** The payload as UTF-8 bytes, which is what byte mode carries. */
const utf8 = text => Array.from(new TextEncoder().encode(text))

/** The index into the level tables for a level id, defaulting to medium. */
const levelIndex = id => {
  const found = LEVELS.findIndex(level => level.id === id)
  return found === -1 ? 1 : found
}

/**
 * The largest payload a level takes, in bytes, at the largest version. Reported
 * to a caller so a field can say what is too long before it is submitted.
 */
export function maximumBytes(levelId) {
  const level = levelIndex(levelId)
  return Math.floor((dataCodewords(40, level) * 8 - 4 - countBits(40)) / 8)
}

/**
 * Encode text as a QR grid.
 *
 * @param {string} text - The payload.
 * @param {object} [options]
 * @param {'L'|'M'|'Q'|'H'} [options.level] - Correction level, medium by default.
 * @param {number} [options.minVersion] - Floor on the version, so a code can be
 *   held at a size while its contents are still being edited.
 * @param {number} [options.mask] - Fixes the mask rather than scoring for it,
 *   which is what lets a grid be compared against a known-good one.
 * @returns {{ size: number, modules: Uint8Array[], version: number, level: string,
 *   mask: number, bytes: number }} The grid, one row per array, a module per entry.
 * @throws {RangeError} When the payload does not fit version 40 at this level.
 */
export function encodeQr(text, { level = 'M', minVersion = 1, mask: fixed } = {}) {
  const bytes = utf8(text)
  const chosen = levelIndex(level)
  const version = versionFor(bytes.length, chosen, minVersion)
  if (version === null) {
    throw new RangeError(
      `${bytes.length} characters is more than a QR code holds. Shorten it, or point the code at a web address that carries the rest.`
    )
  }

  const codewords = interleave(payloadCodewords(bytes, version, chosen), version, chosen)
  const size = version * 4 + 17

  const candidates = fixed === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [fixed]

  let best = null
  for (const mask of candidates) {
    const grid = blankGrid(size)
    placeFunctionPatterns(grid, version)
    placeData(grid, codewords)
    applyMask(grid, mask)
    writeFormatInformation(grid, chosen, mask)
    writeVersionInformation(grid, version)

    const score = penalty(grid)
    if (best === null || score < best.score) best = { grid, score, mask }
  }

  return {
    size,
    modules: best.grid.modules,
    version,
    level: LEVELS[chosen].id,
    mask: best.mask,
    bytes: bytes.length,
  }
}
