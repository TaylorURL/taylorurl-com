/**
 * The draft preview chain: a working site built in a business's own logo,
 * colours and photos, and the four notes that go with it.
 *
 * It is a chain like the other three and it is written down here for the same
 * reason - the days, the sender, the expiry and what takes a business off it
 * were spread across a library and a route, and nothing could read them
 * together. What it does not have is letters in the registry, and that is on
 * purpose: its words are written for each business on another machine and
 * filed on its own row, so there is nothing for a registry to hold. Its steps
 * say where the words come from and register none.
 *
 * `source` names something nothing files. A business is on this chain because
 * a draft was built for it, not because a column says so, so the sender picks
 * the chain by name and the claim here only keeps it from being handed
 * businesses that belong to another chain.
 */

import { defineChain, fromRow } from 'chainwork/core'
import { PREVIEW_FIRST_DAYS, PREVIEW_LIFETIME_DAYS, PREVIEW_FIRST_SENDER } from '../previews.js'

/** A note from Trenton, with the words taken off the row. */
const written = fromRow('letter', { version: 2 })

export default defineChain({
  id: 'preview',
  name: 'Draft preview',
  about: 'A working site in the business’s own logo and photos, and the notes that follow it.',
  // Nothing files this. The draft is what puts a business on the chain.
  source: 'preview-site',
  // No letters in the registry: every one of them is written for the business
  // it is going to and filed on its row.
  segments: [],
  sender: { name: PREVIEW_FIRST_SENDER },
  expiresAfter: PREVIEW_LIFETIME_DAYS,
  steps: [
    { at: 0, channel: 'email', name: 'The draft', letter: written },
    {
      at: PREVIEW_FIRST_DAYS[0],
      slug: 'second',
      channel: 'email',
      name: 'First note',
      letter: written,
    },
    {
      at: PREVIEW_FIRST_DAYS[1],
      slug: 'third',
      channel: 'email',
      name: 'Second note',
      letter: written,
    },
    {
      at: PREVIEW_FIRST_DAYS[2],
      slug: 'last',
      channel: 'email',
      name: 'Last note',
      letter: written,
    },
  ],
})
