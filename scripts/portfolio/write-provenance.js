#!/usr/bin/env node
/**
 * Writes `src/app/data/portfolio-provenance.json` from a day's PageSpeed runs.
 *
 *   node scripts/portfolio/write-provenance.js ~/work/psi-scratch-2026-09-27.jsonl
 *   npm run write:portfolio-provenance -- ~/work/psi-scratch-2026-09-27.jsonl
 *
 * The provenance record is the committed copy of what the last measurement
 * actually read, keyed by each entry's own url, and `check:portfolio-scores`
 * holds every figure on the portfolio page to it. So the record and the figures
 * are written in the same pass from the same runs, and a figure that lands on
 * the wrong entry fails by name rather than passing as a well-formed score.
 *
 * The measurements arrive as one JSON object per line, one line per url per
 * strategy, which is what the PageSpeed pass leaves behind on the machine that
 * took the readings. Only the lines carrying `portfolio: true` are read: a
 * roster site with no row is measured but never stored, and a record under a url
 * the portfolio does not show would fail the gate as an orphan.
 *
 * Entry order follows `PORTFOLIO_PROJECTS` rather than the order the runs
 * happened to finish in, so re-running this against the same file writes the
 * same bytes and the diff on a re-measure is the figures that moved.
 *
 * A url whose strategies did not both come back keeps the record it already
 * has. The gate's question is whether a figure was ever measured against that
 * url, and the last reading answers it; dropping the record instead would fail
 * the entry for a run that went wrong somewhere else.
 *
 * The output goes through Prettier with the repository's own config, because
 * `format:check` sweeps this file like every other and a machine-written file
 * that lands as a formatting failure costs somebody a second push on every
 * release that moves a figure.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const PROVENANCE = resolve(ROOT, 'src/app/data/portfolio-provenance.json')

const [scratchPath] = process.argv.slice(2)
if (!scratchPath) {
  console.error('Name the PageSpeed scratch JSONL to read. Nothing written.')
  process.exit(2)
}

let records
try {
  records = readFileSync(scratchPath, 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line))
} catch (cause) {
  console.error(`Cannot read ${scratchPath} as JSON lines: ${cause.message}`)
  process.exit(2)
}

// An empty pass is a measurement that went wrong rather than a day with nothing
// to record, and writing it would empty the record every stored figure is held
// to.
const measurements = records.filter(record => record.portfolio === true)
if (measurements.length === 0) {
  console.error(`No portfolio measurements in ${scratchPath}. Nothing written.`)
  process.exit(1)
}

const byUrl = new Map()
for (const record of measurements) {
  const strategies = byUrl.get(record.url) ?? {}
  strategies[record.strategy] = record
  byUrl.set(record.url, strategies)
}

const held = JSON.parse(readFileSync(PROVENANCE, 'utf8')).readings ?? {}

const readings = {}
const kept = []
for (const project of PORTFOLIO_PROJECTS) {
  const { mobile, desktop } = byUrl.get(project.url) ?? {}
  const measured = mobile?.status === 'OK' && desktop?.status === 'OK'

  if (!measured) {
    if (!held[project.url]) {
      console.error(
        `${project.slug} was not measured on both strategies and has no record to keep. Nothing written.`
      )
      process.exit(1)
    }
    readings[project.url] = held[project.url]
    kept.push(project.slug)
    continue
  }

  readings[project.url] = {
    slug: mobile.slug,
    mobile: mobile.median,
    desktop: desktop.median,
    measured: mobile.measured_at.slice(0, 10),
    runs: { mobile: mobile.runs_of_record, desktop: desktop.runs_of_record },
    confirmed: { mobile: Boolean(mobile.confirmed), desktop: Boolean(desktop.confirmed) },
  }
}

const today = new Date().toISOString().slice(0, 10)
const record = { measured: today, readings }

// Serialised one field per line and then formatted, rather than formatted from
// one long line. Prettier keeps an object as wide or as tall as it was handed
// it, so the indentation here is what decides that a reading reads as a block,
// and Prettier is what collapses the short run arrays and settles every byte
// after that.
const style = (await resolveConfig(PROVENANCE)) ?? {}
writeFileSync(
  PROVENANCE,
  await format(JSON.stringify(record, null, 2), { ...style, parser: 'json' })
)

console.log(
  `portfolio-provenance.json written: ${Object.keys(readings).length} records, measured ${today}` +
    (kept.length > 0 ? ` — prior record kept for ${kept.join(', ')}` : '')
)
