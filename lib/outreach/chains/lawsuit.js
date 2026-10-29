/**
 * The chain for a business found in a website accessibility suit.
 *
 * A suit is weeks from being settled and the letter is only worth sending
 * while the defendant is still choosing who fixes the site, which is why this
 * chain's businesses sort ahead of everything else in the queue.
 *
 * It claims the source the lawsuit reader files its rows under, so a business
 * in a suit hears these letters and is never drawn the introduction.
 */

import { defineChain, fromCode } from 'chainwork/core'
import { lawsuitFollowUpOpener, lawsuitOpener } from '../openers/plain/lawsuit.js'
import { LAWSUIT_SOURCE } from '../prospects/lawsuits.js'
import { FOLLOW_UP_DAYS } from '../sending/limits.js'

export default defineChain({
  id: 'lawsuit',
  // What the daily recap calls the lane. The letters in it keep their own
  // longer names, which are what the console lists and what is stored.
  name: 'Lawsuit',
  about:
    'Names the website accessibility suit filed against the business and offers the rebuild to WCAG 2.1 AA.',
  source: LAWSUIT_SOURCE,
  steps: [
    {
      at: 0,
      channel: 'email',
      name: 'Accessibility Lawsuit',
      about:
        'Names the website accessibility suit filed against the business and offers the rebuild to WCAG 2.1 AA.',
      // Without the filing date there is no letter to write, so a row that
      // lost it is held rather than sent a letter about a suit it cannot name.
      needs: ['case_filed_on'],
      letter: fromCode(lawsuitOpener),
      plain: true,
    },
    {
      at: FOLLOW_UP_DAYS,
      slug: 'follow-up',
      channel: 'email',
      name: 'Lawsuit Follow-Up',
      about:
        'Asks once more, two weeks on, whether the site still has to be brought up to standard.',
      letter: fromCode(lawsuitFollowUpOpener),
      plain: true,
      unsubscribeLink: false,
      styled: false,
    },
  ],
})
