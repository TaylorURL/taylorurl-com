import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../supabase/supabaseConfig.js'
import { PUBLIC } from '../../../../lib/mail/audience.js'
import { blocksFor } from '../../../../lib/mail/issues.js'

/**
 * Reads the newsletter issues that have gone out, over plain REST.
 *
 * Every query here asks for sent, published rows and nothing else, which is
 * also the only thing the table's select policy permits — the filter states
 * what the page wants, and row-level security is what makes it true. Drafts
 * are unreachable with this key whatever a caller asks for.
 *
 * A body is cut to its unmarked blocks as it arrives, so the blocks written for
 * one side of the mailing list are neither rendered nor carried. This is the
 * door the archive and the build's prerender both come through, and the
 * prerender is why it happens here rather than at the point of drawing: a body
 * filtered only on its way onto the screen is a body already written into the
 * static HTML.
 *
 * No client library: this runs both in the browser, where the SDK would drag
 * an auth stack onto a public page, and in the build, where it would be
 * bundled into Vite's config process.
 */

const ENDPOINT = `${SUPABASE_URL}/rest/v1/newsletter_issues`

const HEADERS = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  Accept: 'application/json',
}

/** Enough for a list entry: no body, so an index of many stays small. */
export const ISSUE_LIST_COLUMNS = 'slug,title,preheader,published_at'

/** The whole issue, for the page that renders one. */
export const ISSUE_COLUMNS = 'slug,title,preheader,body,published_at'

const PUBLISHED = { status: 'eq.sent', published_at: 'not.is.null' }

/** One row with its body cut to the blocks the archive shows. */
function published(row) {
  return row && Array.isArray(row.body) ? { ...row, body: blocksFor(row.body, PUBLIC) } : row
}

async function read(params, signal) {
  const query = new URLSearchParams({ ...PUBLISHED, ...params })
  const response = await fetch(`${ENDPOINT}?${query}`, { headers: HEADERS, signal })
  if (!response.ok) throw new Error(`newsletter issues answered ${response.status}`)
  const rows = await response.json()
  return Array.isArray(rows) ? rows.map(published) : []
}

/**
 * Every sent issue, newest first.
 *
 * @param {{signal?: AbortSignal, columns?: string}} [options]
 * @returns {Promise<Array<object>>}
 */
export function fetchIssues({ signal, columns = ISSUE_LIST_COLUMNS } = {}) {
  return read({ select: columns, order: 'published_at.desc' }, signal)
}

/**
 * One sent issue by slug, or null when there is no such issue.
 *
 * @param {string} slug
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<object|null>}
 */
export async function fetchIssue(slug, { signal } = {}) {
  const rows = await read({ select: ISSUE_COLUMNS, slug: `eq.${slug}`, limit: '1' }, signal)
  return rows[0] ?? null
}
