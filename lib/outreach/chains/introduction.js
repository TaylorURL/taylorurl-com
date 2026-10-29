/**
 * The cold introduction: the letter a business hears first, and the one ask
 * that follows it.
 *
 * This is the chain for a business no draft will be built for - found on the
 * map, by the speed check, or by hand. It is the chain that names no source,
 * which makes it the one every business falls to when nothing else claims it.
 *
 * Its id and its family differ, and both are already stored: the letters were
 * registered as `<segment>-intro` and the family they group under was written
 * as `introduction`. Neither may move, so the manifest states both.
 */

import { defineChain, fromCode } from 'chainwork/core'
import { introductionOpener } from '../openers/plain/introduction.js'
import { meetingOpener } from '../openers/plain/meeting.js'
import { FOLLOW_UP_DAYS } from '../sending/limits.js'

export default defineChain({
  id: 'intro',
  family: 'introduction',
  name: 'Introduction',
  about: 'Who is writing, what they do, where they do it, and nothing asked for.',
  source: null,
  steps: [
    {
      at: 0,
      channel: 'email',
      name: 'Introduction',
      about: 'Who is writing, what they do, where they do it, and nothing asked for.',
      letter: fromCode(introductionOpener),
      plain: true,
    },
    {
      at: FOLLOW_UP_DAYS,
      slug: 'meeting',
      channel: 'email',
      name: 'Meeting Ask',
      about:
        'Points at the work and asks for a half-hour call, or a visit where the business is local.',
      letter: fromCode(meetingOpener),
      plain: true,
      // It goes without the unsubscribe line in the footer. The header that
      // lets a mail client take the reader off the list still goes with it,
      // since `deliver` adds that and never reads the letter.
      unsubscribeLink: false,
      styled: false,
    },
  ],
})
