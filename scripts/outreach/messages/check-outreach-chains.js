/**
 * Proves the console's chain lanes count each business once, at the letter it
 * last had: sent, replied after it, and owed the next one only while its day
 * has come and it has neither written back nor left the chain.
 *
 *   npm run check:outreach-chains
 */

import { chainOf, coldStanding } from '../../../api/outreach-admin.js'
import { check, finish, same } from '../../harness/checks.js'

const NOW = new Date('2026-10-26T15:00:00Z')
const PAST = '2026-10-23T12:00:00Z'
const LATER = '2026-11-02T12:00:00Z'

const rows = [
  { step: 1, stage: 'contacted', next_due_at: PAST, replied_at: null },
  { step: 1, stage: 'contacted', next_due_at: LATER, replied_at: null },
  { step: 1, stage: 'replied', next_due_at: PAST, replied_at: PAST },
  { step: 1, stage: 'bounced', next_due_at: PAST, replied_at: null },
  { step: 2, stage: 'contacted', next_due_at: null, replied_at: null },
  { step: 0, stage: 'contacted', next_due_at: null, replied_at: null },
]
const lane = chainOf(coldStanding(rows), [0, 14], ['Hi', 'Re: Hi'], NOW)

check('every business written to is sent the first letter', () => {
  same(lane.sent, 6, 'written to')
  same(lane.steps[0].sent, 6, 'email 1 sent')
  same(lane.steps[1].sent, 1, 'email 2 sent')
})

check('a reply is counted at the letter it followed', () => {
  same(lane.steps[0].replied, 1, 'replied after email 1')
  same(lane.steps[1].replied, 0, 'replied after email 2')
  same(lane.replied, 1, 'replied in all')
})

check('only a business still on the chain is owed the next letter, once its day has come', () => {
  same(lane.steps[0].next, 2, 'booked for email 2')
  same(lane.steps[0].owed, 1, 'owed email 2 now')
  same(lane.steps[1].next, 0, 'nothing after the last letter')
})

check('each letter carries its day and subject', () => {
  same(lane.steps[1].day, 14, 'day of email 2')
  same(lane.steps[1].subject, 'Re: Hi', 'subject of email 2')
})

finish()
