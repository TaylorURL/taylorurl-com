import { HOME as TAYLORWEBSITE_HOME } from '../taylorwebsite/homeTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

const STUDIO_HOW_IT_WORKS_STEPS = [
  {
    step: '1',
    stage: 'You Start',
    title: 'Tell us what you need',
    description:
      'Send the form and say how you want to be reached. Tell us what the business does and what you need from a website. We usually reply within the hour.',
  },
  {
    step: '2',
    stage: 'We Build',
    title: 'We build it',
    description:
      'You get a plan and a price in writing before any work starts. Then we build it, and you see the site while it goes up.',
  },
  {
    step: '3',
    stage: 'We Ship',
    title: 'Go live',
    description:
      'The site goes live. Hosting, backups, monitoring, and small changes stay with us, so you can get back to running the business.',
  },
]

/**
 * The three steps the home page draws, for whichever site is building.
 *
 * `@views/home/HowItWorksSection` renders one layout off this list, so the
 * second site is three records rather than a second section. The studio's are
 * transcribed from where they were already written, because this selection
 * existing must not move a page that has been indexed for a year.
 *
 * Compared against the substituted literal rather than looked up, so the site
 * that lost is dropped from the bundle instead of shipping the other offer's
 * copy inside this one.
 */
export const HOW_IT_WORKS_STEPS = IS_SECOND_SITE
  ? TAYLORWEBSITE_HOME.steps
  : STUDIO_HOW_IT_WORKS_STEPS

/**
 * The six steps of the build, as the home page's process card draws them and
 * as `@views/Process` labels its rows.
 *
 * Both read from here, so the short form and the long one name the same steps
 * and the same durations. The card draws them as real markup rather than as a
 * captured image: text a search engine can read, and type that follows the
 * reader's light or dark setting instead of standing on a white ground in both.
 */
export const PROCESS_TIMELINE = [
  { step: '01', title: 'First call', duration: 'Day 1' },
  { step: '02', title: 'Plan and price', duration: 'Day 2-3' },
  { step: '03', title: 'Design', duration: 'Week 1' },
  { step: '04', title: 'Build', duration: 'Week 2-3' },
  { step: '05', title: 'Review and launch', duration: 'Week 3-4' },
  { step: '06', title: 'After launch', duration: 'Ongoing' },
]
