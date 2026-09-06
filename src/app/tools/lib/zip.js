/**
 * Writing a zip file in the browser, with nothing compressed.
 *
 * A zip is a run of file records, a table of contents describing them, and a
 * short record saying where that table starts. Nothing about that needs a
 * library, and the one thing a library would add is compression, which is worth
 * nothing here: everything this packs is already a PNG, and a PNG is a deflate
 * stream with a header on it. Storing them costs a few hundred bytes against a
 * download that goes on to be opened by whatever the reader already has.
 *
 * The entries are stored rather than deflated, which every unarchiver on every
 * operating system reads without being asked to.
 */

// The polynomial every zip checksum is taken with, reversed, as the table it is
// usually written out through. Built once on first use.
let crcTable = null

function checksumTable() {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    crcTable[index] = value >>> 0
  }
  return crcTable
}

/** The CRC-32 of some bytes, which every record in the file carries twice. */
export function crc32(bytes) {
  const table = checksumTable()
  let value = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    value = table[(value ^ bytes[index]) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

/**
 * A date as the two 16-bit halves a zip records it in.
 *
 * The format is from MS-DOS and keeps seconds in two-second steps from 1980, so
 * a timestamp arrives back a second out at worst and cannot go back further
 * than that year. Both are fine for a file made to be opened once.
 */
function dosStamp(date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

/** A little-endian writer, which is the byte order the whole format is in. */
function writer(size) {
  const bytes = new Uint8Array(size)
  let at = 0
  return {
    bytes,
    get at() {
      return at
    },
    u16(value) {
      bytes[at] = value & 0xff
      bytes[at + 1] = (value >>> 8) & 0xff
      at += 2
    },
    u32(value) {
      bytes[at] = value & 0xff
      bytes[at + 1] = (value >>> 8) & 0xff
      bytes[at + 2] = (value >>> 16) & 0xff
      bytes[at + 3] = (value >>> 24) & 0xff
      at += 4
    },
    raw(source) {
      bytes.set(source, at)
      at += source.length
    },
  }
}

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_DIRECTORY = 0x06054b50

/**
 * Pack files into a zip.
 *
 * @param {Array<{ name: string, bytes: Uint8Array }>} files - Each name is the
 *   path inside the archive; a name with a slash in it makes a folder.
 * @param {Date} [at] - The timestamp every entry carries.
 * @returns {Uint8Array} The archive.
 */
export function zip(files, at = new Date()) {
  const stamp = dosStamp(at)
  const encoder = new TextEncoder()

  const entries = files.map(file => {
    const name = encoder.encode(file.name)
    return { name, bytes: file.bytes, crc: crc32(file.bytes) }
  })

  const localSize = entries.reduce((total, e) => total + 30 + e.name.length + e.bytes.length, 0)
  const centralSize = entries.reduce((total, e) => total + 46 + e.name.length, 0)
  const out = writer(localSize + centralSize + 22)

  const offsets = []
  for (const entry of entries) {
    offsets.push(out.at)
    out.u32(LOCAL_HEADER)
    out.u16(20) // The version that reads a stored entry.
    out.u16(0) // No flags: nothing here is encrypted or streamed.
    out.u16(0) // Stored.
    out.u16(stamp.time)
    out.u16(stamp.date)
    out.u32(entry.crc)
    out.u32(entry.bytes.length)
    out.u32(entry.bytes.length)
    out.u16(entry.name.length)
    out.u16(0)
    out.raw(entry.name)
    out.raw(entry.bytes)
  }

  const directoryAt = out.at
  entries.forEach((entry, index) => {
    out.u32(CENTRAL_HEADER)
    out.u16(20) // Made by.
    out.u16(20) // Needed to extract.
    out.u16(0)
    out.u16(0)
    out.u16(stamp.time)
    out.u16(stamp.date)
    out.u32(entry.crc)
    out.u32(entry.bytes.length)
    out.u32(entry.bytes.length)
    out.u16(entry.name.length)
    out.u16(0) // Extra.
    out.u16(0) // Comment.
    out.u16(0) // Disk it starts on.
    out.u16(0) // Internal attributes.
    out.u32(0) // External attributes.
    out.u32(offsets[index])
    out.raw(entry.name)
  })

  // Where the trailer starts is also where the table of contents ends, and it
  // has to be taken before the trailer is written: measuring afterwards counts
  // the trailer's own bytes into the table's length and nothing opens the file.
  const trailerAt = out.at
  out.u32(END_OF_DIRECTORY)
  out.u16(0)
  out.u16(0)
  out.u16(entries.length)
  out.u16(entries.length)
  out.u32(trailerAt - directoryAt)
  out.u32(directoryAt)
  out.u16(0)

  return out.bytes
}

/** The archive as a blob, which is what a download is handed. */
export function zipBlob(files, at) {
  return new Blob([zip(files, at)], { type: 'application/zip' })
}
