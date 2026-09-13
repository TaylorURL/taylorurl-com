#!/usr/bin/env node
/**
 * Holds every write to the values its column will actually accept.
 *
 *   npm run check:db-values
 *   npm run check:db-values -- --self-test
 *
 * A Supabase write answers rather than throws, and a route that reads the
 * answer turns a rejection into an exception at the point of the write. That is
 * the right thing and it is not enough, because nothing before production ever
 * says the value was wrong: the database the suite runs against is a plan held
 * in memory, and a plan accepts every string equally.
 *
 * `outreach_messages_intent_check` allowed `opt_out` alone. `watch.js` wrote
 * `auto_reply` for an out-of-office. `check-reply-forwarding.js` asserted that
 * exact value and passed. Every automatic reply the mailbox had received failed
 * to insert, each failure aborted the run it was in - taking the messages
 * behind it with it - and the next run read the same message and failed again,
 * hourly, for as long as it went unnoticed. Nothing in the tree disagreed with
 * anything else in the tree; the tree disagreed with the schema, and no check
 * read both.
 *
 * This one reads both. `db-constraints.json` is the schema's own answer to what
 * each column takes, and the routes are read for the literals they can write
 * into it. Neither is asked to be right about the other: they are compared.
 *
 * What it cannot see is stated rather than skipped. A value assembled at run
 * time is not a literal and is counted, not guessed at, so the line between
 * what was checked and what could not be is a number in the output rather than
 * an assumption in the reader. The snapshot going stale is the other blind
 * spot, and `refresh-db-constraints.js` is the answer to it: run it with the
 * migration, and the diff is the review.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSnapshot, readValueList } from './db-constraints.js'
import { fail, finish } from '../harness/checks.js'
import { filesUnder } from '../harness/files.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')

/** Where code that talks to the database lives. */
const ROUTES = ['api', 'lib', 'src']

/** The calls that carry a row. A select carries none and is not read. */
const WRITES = ['insert', 'update', 'upsert']

let checked = 0
let dynamic = 0

// ── Reading source ───────────────────────────────────────────────────────

/**
 * The object literal starting at `open`, as written.
 *
 * Depth alone would end the object early on the first brace inside a string or
 * a template, and every payload here carries both, so quoting is tracked rather
 * than assumed away.
 *
 * @returns {string | null} The literal including its braces, or nothing where
 *   it does not close.
 */
function objectAt(text, open) {
  let depth = 0
  let quote = null
  for (let at = open; at < text.length; at += 1) {
    const char = text[at]
    if (quote) {
      if (char === '\\') at += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') quote = char
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(open, at + 1)
    }
  }
  return null
}

/**
 * The top-level `key: value` pairs of an object literal.
 *
 * Nesting, arrays, calls, strings and templates are all stepped over, so a
 * comma inside any of them does not end an entry and a colon inside any of them
 * does not name one.
 */
function entriesOf(objectText) {
  const body = objectText.slice(1, -1)
  const entries = []
  let depth = 0
  let quote = null
  let start = 0

  const push = end => {
    const piece = body.slice(start, end).trim()
    if (!piece || piece.startsWith('...')) return
    let colon = -1
    let inner = 0
    let held = null
    for (let at = 0; at < piece.length; at += 1) {
      const char = piece[at]
      if (held) {
        if (char === '\\') at += 1
        else if (char === held) held = null
        continue
      }
      if (char === "'" || char === '"' || char === '`') held = char
      else if ('([{'.includes(char)) inner += 1
      else if (')]}'.includes(char)) inner -= 1
      else if (char === ':' && inner === 0) {
        colon = at
        break
      }
    }
    // A shorthand entry names a variable, which is not a literal to read.
    if (colon === -1) return
    entries.push({
      key: piece
        .slice(0, colon)
        .trim()
        .replace(/^['"]|['"]$/g, ''),
      value: piece.slice(colon + 1).trim(),
    })
  }

  for (let at = 0; at < body.length; at += 1) {
    const char = body[at]
    if (quote) {
      if (char === '\\') at += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') quote = char
    else if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) depth -= 1
    else if (char === ',' && depth === 0) {
      push(at)
      start = at + 1
    }
  }
  push(body.length)
  return entries
}

/**
 * Every `NAME = 'value'` the tree declares, so a write naming one is still read.
 *
 * The routes overwhelmingly write a constant rather than a bare string -
 * `status: SENT` rather than `status: 'sent'` - which is the better way to
 * write it and would leave a checker reading only literals blind to almost
 * every write that matters. Uppercase alone, because that is what names a
 * constant here and a rule that swept every `const` would resolve variables
 * holding whatever the last assignment put in them.
 *
 * A name declared twice with different values is dropped rather than guessed
 * at: which one a file meant is a question about imports, and answering it
 * wrongly is worse than saying nothing.
 */
function constantsIn(files) {
  const seen = new Map()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const [, name, value] of text.matchAll(
      /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*'((?:[^'\\]|\\.)*)'/g
    )) {
      const held = seen.get(name)
      if (held === undefined) seen.set(name, value)
      else if (held !== value) seen.set(name, null)
    }
  }
  return seen
}

/**
 * The value positions of an expression, told apart from its conditions.
 *
 * A ternary carries both, and only the branches are ever written to the
 * column: in `asked.optOut ? 'opt_out' : machine.auto ? 'auto_reply' : null`
 * the two property reads are tests and the two strings are the row. Splitting
 * on the top-level `?` and `:` gives the pieces in order, and the piece a `?`
 * follows is the test - which is the whole of the rule, nesting included.
 */
function valuePositions(expression) {
  const pieces = []
  let depth = 0
  let quote = null
  let start = 0
  for (let at = 0; at < expression.length; at += 1) {
    const char = expression[at]
    if (quote) {
      if (char === '\\') at += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') quote = char
    else if ('([{'.includes(char)) depth += 1
    else if (')]}'.includes(char)) depth -= 1
    else if ((char === '?' || char === ':') && depth === 0) {
      pieces.push({ text: expression.slice(start, at).trim(), followedBy: char })
      start = at + 1
    }
  }
  pieces.push({ text: expression.slice(start).trim(), followedBy: null })
  return pieces.filter(piece => piece.followedBy !== '?').map(piece => piece.text)
}

/**
 * The values an expression can write, where every one of them can be named.
 *
 * A call, an index or a property read produces its value at run time, and a
 * guess about it would be the checker inventing the very agreement it is here
 * to test. Those are counted as unread rather than passed, which is what keeps
 * the number at the bottom honest.
 *
 * Null is skipped rather than refused. A CHECK is only broken by a result of
 * false and a comparison against null yields null, so a null write has never
 * been this constraint's business; whether the column takes one is its NOT NULL
 * setting, which is a different constraint and a different question.
 *
 * @returns {string[] | null} The values, or nothing where any of them is built.
 */
function literalsIn(expression) {
  const values = []
  for (const piece of valuePositions(expression)) {
    const bare = piece.replace(/^\(+|\)+$/g, '').trim()
    if (bare === '' || bare === 'null' || bare === 'undefined') continue

    const string = bare.match(/^'((?:[^'\\]|\\.)*)'$|^"((?:[^"\\]|\\.)*)"$/)
    if (string) {
      values.push(string[1] ?? string[2])
      continue
    }

    if (/^[A-Z][A-Z0-9_]*$/.test(bare)) {
      const held = CONSTANTS.get(bare)
      if (held == null) return null
      values.push(held)
      continue
    }

    return null
  }
  return values.length > 0 ? values : null
}

// ── The sweep ────────────────────────────────────────────────────────────

/** Every source file that could carry a write. */
const FILES = ROUTES.flatMap(dir => {
  try {
    return filesUnder(join(ROOT, dir), /\.jsx?$/)
  } catch {
    return []
  }
})

const CONSTANTS = constantsIn(FILES)

const { columns, raw } = loadSnapshot()

// The snapshot is a copy of the schema and this file is the only reader that
// can tell whether it is still a faithful one, so the definitions it carries
// are parsed again and compared to the sets beside them. A snapshot edited by
// hand to make a check pass is the one way this whole gate becomes theatre.
for (const [table, byColumn] of Object.entries(raw.columns ?? {})) {
  for (const [column, held] of Object.entries(byColumn)) {
    const again = readValueList(held.definition)
    const agrees =
      again &&
      again.column === column &&
      again.allows.length === held.allows.length &&
      again.allows.every(value => held.allows.includes(value))
    if (!agrees) {
      fail(
        `${table}.${column}: the snapshot's list does not follow from the definition beside it. ` +
          `Refresh it rather than editing it: npm run refresh:db-constraints`
      )
    }
  }
}

{
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8')
    const where = relative(ROOT, file)
    const from = /\.from\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g

    for (const hit of text.matchAll(from)) {
      const table = hit[1]
      const after = hit.index + hit[0].length
      // The chain runs until the next table is named. Reading past that would
      // file one route's row against another route's table.
      const next = text.slice(after).search(/\.from\(\s*['"]/)
      const chain = text.slice(after, next === -1 ? text.length : after + next)

      const call = chain.match(new RegExp(`\\.(${WRITES.join('|')})\\(`))
      if (!call) continue

      const opens = chain.indexOf('{', call.index + call[0].length)
      if (opens === -1) continue
      // A payload named rather than written is a row this sweep cannot read.
      // Only a brace immediately after the paren is the literal itself.
      if (chain.slice(call.index + call[0].length, opens).trim() !== '') continue

      const object = objectAt(chain, opens)
      if (!object) continue

      for (const entry of entriesOf(object)) {
        const held = columns.get(`${table}.${entry.key}`)
        if (!held) continue

        const literals = literalsIn(entry.value)
        if (!literals) {
          dynamic += 1
          continue
        }

        for (const value of literals) {
          checked += 1
          if (held.allows.includes(value)) continue
          fail(
            `${where}: ${table}.${entry.key} is written '${value}', which ${held.constraint} refuses. ` +
              `It takes ${held.allows.map(one => `'${one}'`).join(', ')}.`
          )
        }
      }
    }
  }
}

// ── Saying so ────────────────────────────────────────────────────────────

if (process.argv.includes('--self-test')) {
  // The bug this exists for, put back: the constraint as it stood, against the
  // value the route writes. A gate that cannot be shown catching the thing it
  // was built for is a gate nobody can trust after the thing is fixed.
  const before = readValueList("CHECK ((intent = 'opt_out'::text))")
  const writes = literalsIn("asked.optOut ? 'opt_out' : machine.auto ? 'auto_reply' : null")
  const refused = writes.filter(value => !before.allows.includes(value))
  if (refused.join() !== 'auto_reply') {
    fail(`self-test: expected 'auto_reply' to be refused, got ${JSON.stringify(refused)}`)
  }
  const now = readValueList(
    "CHECK (((intent IS NULL) OR (intent = ANY (ARRAY['opt_out'::text, 'auto_reply'::text]))))"
  )
  if (writes.some(value => !now.allows.includes(value))) {
    fail('self-test: the widened constraint should accept both values')
  }
  await finish()
  console.log(
    'check-db-values self-test: the constraint as it stood refuses auto_reply; as widened it does not.'
  )
}

await finish()

console.log(
  `check-db-values: ${checked} written values across ${columns.size} constrained columns all stand, ` +
    `${dynamic} built at run time and not read.`
)
