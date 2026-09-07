/**
 * What the database will accept in a column, read off its own CHECK constraints.
 *
 * A Supabase write answers rather than throws, and the answer a rejected write
 * gives names the constraint rather than the value, so the fault reads as
 * infrastructure long after it is a plain disagreement between two files. The
 * disagreement that prompted this one: `outreach_messages_intent_check` allowed
 * `opt_out` alone, `api/outreach/watch.js` wrote `auto_reply` for an
 * out-of-office, and every automatic reply the mailbox had ever received failed
 * to insert. The suite passed throughout, because the database the tests run
 * against is a plan in memory and a plan accepts anything.
 *
 * So the constraints are held in the tree, beside the code that has to satisfy
 * them, and `check-db-values.js` reads both. This module is the part they share:
 * turning a constraint definition into the set of values it permits, and saying
 * plainly when a definition is not that shape.
 *
 * Only value lists are read. A range, a cross-column rule and a pinned id are
 * all real constraints and none of them is a set of words a route can be caught
 * writing the wrong one of, so they are carried in the snapshot as definitions
 * and nothing pretends to check them.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Where the snapshot of the live schema's constraints is kept. */
export const SNAPSHOT = join(HERE, 'db-constraints.json')

/** The query the snapshot is taken with, held here so a refresh cannot drift. */
export const CONSTRAINT_QUERY = `select rel.relname as table_name,
       con.conname as constraint_name,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and con.contype = 'c'
order by rel.relname, con.conname`

/**
 * The values a constraint definition permits, where it names a set of them.
 *
 * Two shapes are read, because Postgres prints a set of one differently from a
 * set of several: `col = ANY (ARRAY['a'::text, 'b'::text])` and `col =
 * 'a'::text`. A definition wrapping either in `col IS NULL OR ...` reads the
 * same, since a CHECK is only broken by a result of false and a comparison
 * against NULL yields NULL. That is why writing null was never the failure here
 * and why null is not carried in the set: whether a column takes null is its
 * NOT NULL setting, which is a different constraint and a different question.
 *
 * Every clause read has to name the same column. A rule spanning two of them
 * says something about the pair rather than about either alone, and a set of
 * words is the wrong summary of it.
 *
 * @param {string} definition - `pg_get_constraintdef` output.
 * @returns {{column: string, allows: string[]} | null} The column and what it
 *   takes, or nothing where the definition is not a value list.
 */
export function readValueList(definition) {
  const found = new Map()

  const add = (column, values) => {
    const held = found.get(column) ?? []
    found.set(column, held.concat(values))
  }

  const list = /(\w+)\s*=\s*ANY\s*\(\s*ARRAY\[([^\]]*)\]/g
  for (const [, column, body] of definition.matchAll(list)) {
    add(
      column,
      [...body.matchAll(/'((?:[^']|'')*)'/g)].map(hit => hit[1].replace(/''/g, "'"))
    )
  }

  const single = /(\w+)\s*=\s*'((?:[^']|'')*)'::text/g
  for (const [, column, value] of definition.matchAll(single)) {
    add(column, [value.replace(/''/g, "'")])
  }

  if (found.size !== 1) return null
  const [column, values] = [...found][0]
  if (values.length === 0) return null
  return { column, allows: [...new Set(values)] }
}

/**
 * The snapshot, keyed for lookup rather than for reading.
 *
 * @param {string} [path] - The file to read, for a test driving its own.
 * @returns {{columns: Map<string, {allows: string[], constraint: string}>, raw: object}}
 *   `columns` is keyed `table.column`.
 */
export function loadSnapshot(path = SNAPSHOT) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  const columns = new Map()
  for (const [table, byColumn] of Object.entries(raw.columns ?? {})) {
    for (const [column, held] of Object.entries(byColumn)) {
      columns.set(`${table}.${column}`, held)
    }
  }
  return { columns, raw }
}

/**
 * The snapshot as it would be written from a set of constraint rows.
 *
 * Shared with the refresh so the file a refresh writes is the file the gate
 * expects, and so a snapshot edited by hand is caught rather than believed.
 *
 * @param {Array<{table_name: string, constraint_name: string, definition: string}>} rows
 * @returns {object} The snapshot document.
 */
export function buildSnapshot(rows) {
  const columns = {}
  const unread = []

  for (const row of [...rows].sort((a, b) =>
    `${a.table_name}.${a.constraint_name}`.localeCompare(`${b.table_name}.${b.constraint_name}`)
  )) {
    const read = readValueList(row.definition)
    if (!read) {
      unread.push({
        table: row.table_name,
        constraint: row.constraint_name,
        definition: row.definition,
      })
      continue
    }
    columns[row.table_name] ??= {}
    columns[row.table_name][read.column] = {
      constraint: row.constraint_name,
      allows: read.allows,
      definition: row.definition,
    }
  }

  return {
    note: 'Taken from the live schema. Refresh with: npm run refresh:db-constraints',
    schema: 'public',
    columns,
    unread,
  }
}
