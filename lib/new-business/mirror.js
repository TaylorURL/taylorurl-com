/**
 * A new business's row in `outreach_prospects`, which is how it shows on the
 * outreach console next to the businesses outreach found, and how two things
 * already built for that table reach it.
 *
 * A company with a phone number and no address goes on the call list, which
 * reads that table and nothing else. A company that has been written to is
 * matched by the inbox watcher, which reads replies, bounces and opt-outs by
 * the address on that table, and so gets the stop and the suppression row a
 * bounce or an opt-out earns without a second watcher on the same mailbox.
 *
 * The rows are written at stages outreach's own jobs never take a row from.
 * The phone-only row is 'unreachable' with no address and a reason the retry
 * does not know, so nothing enriches it or writes to it. The written-to row is
 * 'contacted' with nothing due, so no follow-up is ever drawn for it. The
 * pipeline that owns the business is this one, and the mirror is only ever
 * written from here.
 */

import { displayName } from './filings.js'

/** What `outreach_prospects.source` says on a mirrored row. */
export const MIRROR_SOURCE = 'new-business'

/** The reason on a phone-only row, which no retry in outreach reads. */
export const PHONE_ONLY_REASON = 'New business with a phone number and no email address'

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
