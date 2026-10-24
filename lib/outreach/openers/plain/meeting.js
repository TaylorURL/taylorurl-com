/**
 * The second letter: the work, and a half-hour call to talk it through.
 *
 * The introduction two weeks before asked for nothing, so this is the first
 * letter that asks for anything, and it asks for the one thing a business
 * owner can say yes to without deciding to buy: a call, or a visit where the
 * business is close enough to drive to. It opens on the first letter rather
 * than pretending there was none, because a reader who half remembers it
 * reads this as the same person writing again, and one who does not is told
 * who is writing before anything is asked.
 *
 * The proof comes before the ask. One link to the work, then two clients a
 * reader around Houston may well have driven past, named with their towns.
 * Both have to stay on the portfolio page the link opens, which the variants
 * check holds them to.
 *
 * It threads under the first letter, so a mail client files the two together
 * and the introduction sits underneath the question it leads up to.
 *
 * It goes without the unsubscribe line in the footer and without the
 * background and type the introduction is set in, so it reads in the reader's
 * own mail client like anything else they were sent by a person; the registry
 * entry says so and `compose` reads it. The List-Unsubscribe header still goes
 * with every send, so the way off the list the mail client shows is still
 * there.
 */

import { BIO_NAME, BIO_PHONE } from '../../../mail/bio.js'
import { bareHost, causesLine, plainLetter, threaded } from './shared.js'
import { hasNoSite, phoneSeconds, plainName, searchOf } from './research.js'

/** The subject where there is no first letter to thread under, which is the introduction's own. */
const SUBJECT = `${BIO_NAME}, TaylorURL`

/** The two clients the letter names. Both are on the portfolio page it links. */
const KNOWN = 'Speedway 146 in Baytown and Impressiva Printing in Pasadena'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How long ago the first letter went, said the way a person would say it.
 *
 * The letter is owed two weeks after the first and most go then, but one
 * that waited its turn in a long queue, or whose send was put off, goes later.
 * The opening line is the one claim in it a reader can check against their
 * own inbox, so it is read off the day the first letter was actually sent.
 * Where there is no day to read, as in a preview, it says two weeks.
 *
 * @param {string|Date|null|undefined} sentAt When the first letter was sent.
 * @param {Date} [at] The moment this one is written for.
 */
export function sinceFirst(sentAt, at = new Date()) {
  const days = sentAt ? (new Date(at).getTime() - new Date(sentAt).getTime()) / DAY_MS : NaN
  if (!Number.isFinite(days) || days < 18) return 'a couple of weeks ago'
  if (days < 25) return 'about three weeks ago'
  if (days < 45) return 'about a month ago'
  return 'a while back'
}

export function meetingOpener(prospect, where, shot, context = {}) {
  const name = plainName(prospect.name)
  const seconds = phoneSeconds(prospect)
  const search = searchOf(prospect)
  // What was found, said again in one line, so this letter stands on its own
  // for a reader who never opened the first.
  const recap = hasNoSite(prospect)
    ? `${name} still doesn't have a website of its own${search ? `, so anyone searching "${search}" only finds your map listing` : ''}.`
    : seconds !== null && seconds >= 3
      ? `${bareHost(prospect.website) ?? 'Your site'} was taking ${seconds} seconds to show on a phone when I checked. ${causesLine(prospect)}`
      : `I've been thinking about what a better site would do for ${name}.`
  const work = context.site
    ? `Here's work I've done for other businesses around Houston, including ${KNOWN}:\n${context.site}`
    : `I've done the same for businesses around Houston, including ${KNOWN}.`
  return plainLetter(threaded(context, SUBJECT), [
    `I wrote to you ${sinceFirst(context.prior?.sent_at, context.at)} about ${name}'s website. ${recap}`,
    work,
    `I'd like 15 minutes to show you exactly what I'd do for ${name}. If you're local, I'm happy to drive out to you instead.`,
    `What day works? Reply here, or call or text me at ${context.phone ?? BIO_PHONE}.`,
  ])
}
