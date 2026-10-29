/**
 * The new-business chain: one letter to a company whose filing has just been
 * recorded.
 *
 * Like the draft preview, it registers no letters. Its words are composed from
 * the lead rather than drawn from a registry, and its leads and its messages
 * live in tables of their own. What is written down here is its shape - one
 * step, on the day the lead is ready - so the recap and the console can read
 * it beside the others instead of knowing it separately.
 */

import { defineChain, fromCode } from 'chainwork/core'
import { composeFor } from '../../new-business/email.js'

export default defineChain({
  id: 'new-business',
  name: 'New business',
  about: 'One letter to a company whose filing has just been recorded.',
  // Nothing files this either: a lead on this chain is a row in
  // new_business_leads rather than a business carrying a source.
  source: 'new-business-filing',
  segments: [],
  steps: [{ at: 0, channel: 'email', name: 'New business', letter: fromCode(composeFor) }],
})
