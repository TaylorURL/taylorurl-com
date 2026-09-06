/**
 * The web presence letter: the opener for a business whose listing points at
 * a page on somebody else's platform.
 *
 * This is the opener the sender has always used for a business with no site
 * of its own, kept word for word.
 */

import { CLOSE, OFFER } from './shared.js'

/** The opener for a business whose listing points at a platform profile. */
export function siteOpener(prospect, where) {
  const name = prospect.name.slice(0, 60)

  return {
    subject: 'no website of your own',
    marker: '// Web Presence',
    lines: [
      `I went looking for your website this week. The only thing your listing points at is a page on somebody else's platform.`,
    ],
    figure: {
      label: 'Your Listing',
      meta: 'Platform',
      value: 'No Site',
      unit: 'of your own',
      band: 'plain',
      meaning: `That page belongs to the platform, not to ${prospect.name}. It does what the platform allows and nothing past it.`,
    },
    after: [
      `A site of your own puts the people searching for you on a page you control, with your hours, your number and your work on it. That's most of what I do for small businesses ${where}.`,
      OFFER(`to see what one would cover for ${name}`),
    ],
    close: CLOSE,
  }
}
