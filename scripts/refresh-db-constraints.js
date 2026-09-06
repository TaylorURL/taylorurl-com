#!/usr/bin/env node
/**
 * Takes the constraint snapshot again from the live schema.
 *
 *   npm run refresh:db-constraints -- --query          # the query to run
 *   <the query's JSON result> | npm run refresh:db-constraints
 *
 * The snapshot is what `check-db-values.js` holds the routes to, and it is a
 * copy, so it goes stale the moment a migration lands without one. Run this in
 * the same breath as the migration and the copy and the schema agree again; the
 * diff it writes is the review of what the migration actually did.
 *
 * It reads the catalogue through whoever is already holding the database rather
 * than opening its own way in. There is no `sql` RPC published here and no
 * Postgres driver in the tree, and the two ways to change that - a function
 * that runs arbitrary SQL, or a driver and a connection string in the
 * environment - are both a standing key to the whole schema, bought so a
 * checker can read a catalogue table. So the query goes wherever a query
 * already goes, the Supabase SQL editor or a session holding the project, and
 * its answer comes back through a pipe. The query text and the file format live
 * here, which is the part that must not drift; the connection is not this
 * script's to own.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { format, resolveConfig } from 'prettier'
import { buildSnapshot, CONSTRAINT_QUERY, SNAPSHOT } from './db-constraints.js'

if (process.argv.includes('--query')) {
  console.log(CONSTRAINT_QUERY)
  process.exit(0)
}

if (process.stdin.isTTY) {
  console.error(
    'Nothing on stdin. Run with --query for the query, then pipe its JSON result back in.'
  )
  process.exit(2)
}

let rows
try {
  rows = JSON.parse(readFileSync(0, 'utf8'))
} catch (cause) {
  console.error(`That is not JSON: ${cause.message}`)
  process.exit(2)
}

// An empty answer is not a schema with no constraints, it is a query that went
// wrong. Writing it would empty the snapshot and leave every check after it
// passing against nothing, which is the failure this whole file exists to stop.
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('No constraints in that answer, which is not a schema. Nothing written.')
  process.exit(1)
}

const missing = rows.find(row => !row?.table_name || !row?.constraint_name || !row?.definition)
if (missing) {
  console.error('A row is missing table_name, constraint_name or definition. Nothing written.')
  process.exit(1)
}

const snapshot = buildSnapshot(rows)

// Written the way the repository writes JSON, so `format:check` covers the
// snapshot like everything else and a refresh never lands as a formatting
// failure somebody has to chase.
const style = (await resolveConfig(SNAPSHOT)) ?? {}
writeFileSync(SNAPSHOT, await format(JSON.stringify(snapshot), { ...style, parser: 'json' }))

const read = Object.values(snapshot.columns).reduce((n, held) => n + Object.keys(held).length, 0)
console.log(
  `Snapshot written: ${rows.length} constraints, ${read} of them value lists a route can be held to, ` +
    `${snapshot.unread.length} carried as definitions only.`
)
