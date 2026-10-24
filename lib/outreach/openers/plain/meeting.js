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
import { bareHost, plainLetter, threaded } from './shared.js'
import { hasNoSite, phoneSeconds, pick, plainName } from './research.js'

/** The subject where there is no first letter to thread under, which is the introduction's own. */
const SUBJECT = `${BIO_NAME}, TaylorURL`

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
  const seed = prospect.name
  const seconds = phoneSeconds(prospect)
  const when = sinceFirst(context.prior?.sent_at, context.at)
  const opener = pick(seed, [
    `Wanted to follow up on my email from ${when}.`,
    `Just circling back on my note from ${when}.`,
  ])
  const recap = hasNoSite(prospect)
    ? `Still think a simple site would pay for itself pretty quick for ${name}.`
    : seconds !== null && seconds >= 3
      ? `The load time on ${bareHost(prospect.website) ?? 'your site'} is an easy fix, and it's the kind of thing that quietly costs calls.`
      : `Still think there's an easy win on the website for ${name}.`
  const work = context.site
    ? `Here's some of what I've done around here, Speedway 146 in Baytown is one: ${context.site}`
    : `Speedway 146 in Baytown is one I did recently if you want to see my work.`
  const ask = pick(seed, [
    `I'm local, so I can come by if that's easier. Is there a day this week that works? Or call me at ${context.phone ?? BIO_PHONE}.`,
    `Happy to swing by in person if you'd rather. What day's good for you? My cell is ${context.phone ?? BIO_PHONE}.`,
  ])
  return plainLetter(threaded(context, SUBJECT), [`${opener} ${recap}`, work, ask])
}
