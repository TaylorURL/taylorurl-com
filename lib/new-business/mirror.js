/**
 * A new business's row in `outreach_prospects`, which is how it shows on the
 * outreach console next to the businesses outreach found, and how two things
 * already built for that table reach it.
 *
 * Every company with a phone number goes on the call list, which reads that
 * table and nothing else, and it goes there the moment its number is found:
 * a company with an address and a number is rung as well as written to, and
 * the call does not wait for the letter. A company that has been written to is
 * matched by the inbox watcher, which reads replies, bounces and opt-outs by
 * the address on that table, and so gets the stop and the suppression row a
 * bounce or an opt-out earns without a second watcher on the same mailbox.
 *
 * The rows are written at stages outreach's own jobs never take a row from.
 * The phone-only row and the row for a company still to be written to are
 * both 'unreachable' with no address on them and a reason the retry does not
 * know, so nothing enriches them, the outreach sender (which reads only rows
 * carrying an address) never writes to them, and the sweep (which reads only
 * 'found', 'enriched', 'audited' and 'queued') never skips them. The address
 * goes onto the row with the letter: the written-to row is 'contacted' with
 * nothing due, so no follow-up is ever drawn for it, and it is the same row,
 * upserted over the one before by source and taxpayer number. The pipeline
 * that owns the business is this one, and the mirror is only ever written
 * from here.
 */

import { displayName } from './filings.js'

/** What `outreach_prospects.source` says on a mirrored row. */
export const MIRROR_SOURCE = 'new-business'

/** The reason on a phone-only row, which no retry in outreach reads. */
export const PHONE_ONLY_REASON = 'New business with a phone number and no email address'

/** The reason on a row for a company with an address too, waiting for its letter; no retry reads it either. */
export const CALL_FIRST_REASON = 'New business with a phone number, not yet written to'

/** The columns every mirrored row carries, whatever its stage. */
function base(lead) {
  return {
    source: MIRROR_SOURCE,
    source_ref: lead.taxpayer_number,
    name: displayName(lead.name) || lead.name,
    address: [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ') || null,
    town: lead.city ? displayName(lead.city) : null,
    website: lead.website ?? null,
    phone: lead.phone ?? null,
  }
}

/** The row for a company that can only be rung. */
export function phoneOnlyRow(lead) {
  // 'none' is the kind the call list takes, and it is the true one for the
  // question the call list asks: there is no address to write to.
  return {
    ...base(lead),
    site_kind: 'none',
    email: null,
    stage: 'unreachable',
    skip_reason: PHONE_ONLY_REASON,
  }
}

/**
 * The row for a company with an address and a number that has not been
 * written to yet, so it is on the call list while the letter waits its turn.
 *
 * The address is left off the row on purpose. The outreach sender writes to
 * any 'unreachable' row carrying one, and this company's letter is this
 * pipeline's to send; `contactedRow` puts the address on when it has gone.
 */
export function callFirstRow(lead) {
  return {
    ...base(lead),
    site_kind: 'own',
    email: null,
    stage: 'unreachable',
    skip_reason: CALL_FIRST_REASON,
  }
}

/** The row a company with a phone number is mirrored as when its number is found. */
export function phoneRow(lead) {
  return lead.email ? callFirstRow(lead) : phoneOnlyRow(lead)
}

/** The row for a company that has been written to. */
export function contactedRow(lead, sentAt) {
  return {
    ...base(lead),
    site_kind: 'own',
    email: lead.email,
    stage: 'contacted',
    contacted_at: sentAt,
    step: 1,
    next_due_at: null,
    skip_reason: null,
  }
}

/** Writes a mirror row, and hands back its id. */
export async function mirror(db, row) {
  const { data, error } = await db
    .from('outreach_prospects')
    .upsert(row, { onConflict: 'source,source_ref' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

/**
 * A stop carried onto the mirror row, where the lead has one: a company held
 * back because its address is on the suppression list is not rung either.
 */
export async function stopMirror(db, prospectId, stage = 'unsubscribed') {
  if (!prospectId) return
  const { error } = await db.from('outreach_prospects').update({ stage }).eq('id', prospectId)
  if (error) throw new Error(error.message)
}

/**
 * What the watcher has learned about companies already written to: the stage
 * each mirror row stands at, by its lead.
 */
export async function mirroredStages(db, prospectIds) {
  if (!prospectIds.length) return new Map()
  const { data, error } = await db
    .from('outreach_prospects')
    .select('id, stage')
    .in('id', prospectIds)
  if (error) throw new Error(error.message)
  return new Map(data.map(row => [row.id, row.stage]))
}
