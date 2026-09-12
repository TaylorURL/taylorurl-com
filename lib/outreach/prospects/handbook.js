/**
 * What to say on the call, and what to say back.
 *
 * The call list next door answers who to ring and in what order, and it stops
 * exactly where the phone starts ringing. Everything past that point was
 * carried in one person's head: the opening line, the price, what the monthly
 * covers, what to say to somebody who already has a Facebook page and cannot
 * see what is wrong with it. A list that hands a caller a number and nothing
 * else is a list that only works for the person who built it.
 *
 * Three kinds of thing live here and they are not interchangeable.
 *
 * THE SCRIPT IS COMPOSED PER BUSINESS. `scriptFor` reads the row the caller is
 * looking at and writes the opening out with that business's own facts in it -
 * the platform their listing points at, the reviews they have against the
 * middle for their trade, the client of ours in their line of work. A generic
 * opener is one a caller has to translate while somebody is waiting on the
 * line, and it is also the one that gets the call hung up: the first fifteen
 * seconds have to prove the caller looked them up rather than bought a list.
 *
 * THE ANSWERS ARE FIXED. What a website costs, what the monthly buys, who owns
 * the domain, how long a build takes - a caller who improvises those is a
 * caller who will contradict the pricing page by the second call. Every figure
 * in them is imported from where the site holds it, so a price that moves on
 * the pricing page moves here in the same commit and cannot be quoted two ways.
 *
 * THE PUSHBACK IS THE PART THAT IS ACTUALLY HARD. Eight objections cover
 * nearly every call that does not end at a voicemail, and the answer to each
 * is a sentence rather than a rebuttal - the goal of the call is a plan and a
 * price, not winning an argument with somebody at their own counter.
 *
 * Strings and pure functions only. This is imported into the browser bundle
 * beside `calls.js`, so a database, a network call or a date formatter here
 * would break that bundle the way it would break its neighbour's.
 */

import { BUILD_PRICE, MARKET, MONTHLY_PRICE } from '../../../src/app/data/checkout/pricing.js'
import { PORTFOLIO_AVERAGES } from '../../../src/app/data/portfolio.js'
import { SITE } from '../../site/current.js'
import { platformName, hostOf } from './platforms.js'
import { presenceOf } from './calls.js'

/**
 * The five things a caller reaches for, in the order a call goes through them.
 *
 * Named as parts of a call rather than as topics, because a caller with a
 * phone against their ear is looking for the moment they are in rather than
 * for a subject heading.
 */
export const HANDBOOK_PARTS = Object.freeze([
  { id: 'open', label: 'Opening' },
  { id: 'questions', label: 'Common Questions' },
  { id: 'pushback', label: 'Objections' },
  { id: 'facts', label: 'Pricing and Facts' },
  { id: 'close', label: 'Closing' },
])

/**
 * A whole-dollar figure said the way a person says it.
 *
 * The comparison band is held as numbers beside the studio's own price, and a
 * number read out on a call has to carry its separator or it is misheard as
 * ten times itself.
 */
const dollars = amount => `$${Number(amount).toLocaleString('en-US')}`

// ── The opening, written for the business on the screen ────────────────────

/**
 * The line that gets past whoever answers.
 *
 * Deliberately short and deliberately not a pitch. The person answering a
 * shop's phone is not the person who buys a website, and a caller who opens
 * with the pitch has spent it on somebody who cannot say yes.
 */
const GREETING = 'Hi, is the owner around?'

/** The same line for a business somebody has already been held at once. */
const GREETING_AGAIN =
  'Hi, I called earlier in the week and was told to try back. Is the owner around?'

/**
 * Who the caller says they are.
 *
 * The one word in the script nobody but the caller can write, and the one the
 * console happens to know: whoever is signed in put a name in Settings, and
 * the first word of it is what somebody says on the phone. A bracket is what a
 * script has always left in its place, and it stays wherever there is no name
 * to put there.
 *
 * Anything that is not plainly a name is left as the slot rather than said. A
 * caller reads this line out loud without looking at it after the first day,
 * and an address or an initial coming out of their mouth is worse than a blank
 * they already know to fill.
 */
function saidName(caller) {
  const [first = ''] = String(caller ?? '')
    .trim()
    .split(/\s+/)
  return /^[\p{L}][\p{L}'-]+$/u.test(first) ? first : '[your name]'
}

/**
 * What is wrong with their listing, said the way it would be said out loud.
 *
 * `whyListed` in `calls.js` writes the same fact for the caller to read; this
 * writes it for the caller to say, which is a different sentence. The written
 * one explains why the row is on a list. The spoken one has to sound like
 * somebody who looked them up two minutes ago, because that is what it is.
 */
function listingLine(row) {
  const platform = platformName(hostOf(row?.website))
  const presence = presenceOf(row)
  if (presence === 'none') {
    return (
      'I looked you up on Google and your listing has a phone number and a map pin, but no ' +
      'website. Anybody who wants your hours or your prices has to call you to find out.'
    )
  }
  if (presence === 'portal') {
    return (
      `I looked you up on Google and the website on your listing goes to ${platform || 'a directory'}, ` +
      'which somebody else put you in. It carries your name with their phone number and their ' +
      'advertising around it.'
    )
  }
  if (presence === 'booking') {
    return (
      `I looked you up on Google and the website on your listing is your ${platform || 'booking'} page. ` +
      'You pay for that page every month and it still belongs to them, with their address at the ' +
      'bottom and nothing on it Google can rank as yours.'
    )
  }
  return (
    `I looked you up on Google and the website on your listing is your ${platform || 'social'} page. ` +
    'They decide who sees it, and if that account goes tomorrow there is nothing of yours left ' +
    'online.'
  )
}

/**
 * Their trade, said as a fact about them rather than as a statistic.
 *
 * The number is the same one the score is built on, and it is the single most
 * persuasive thing on the call for a busy business: somebody who has quietly
 * outperformed every shop in their trade has never been told so.
 */
function tradeLine(row) {
  const count = row?.rating_count
  const median = row?.trade_median
  const trade = row?.trade || 'your line of work'
  if (typeof count !== 'number' || median === null || median === undefined) {
    return (
      `Google has too few ${trade} listings around here for me to measure you against. What I can ` +
      'see is that there is nowhere for the people looking for you to land.'
    )
  }
  const middle = Math.round(median)
  if (row?.pull === 'busy') {
    return (
      `You have ${count} reviews and the middle for ${trade} listings around here is about ` +
      `${middle}, so you are well ahead of the shops you compete with. The ones with a website ` +
      'are still getting found ahead of you.'
    )
  }
  if (row?.pull === 'quiet') {
    return (
      `You have ${count} reviews and the middle for ${trade} listings around here is about ` +
      `${middle}. That is what happens when there is nowhere for people to find you and nothing ` +
      'asking them to leave one.'
    )
  }
  return (
    `You have ${count} reviews, about where most ${trade} listings sit around here. The shops ` +
    'pulling ahead are the ones people can find on a phone at eight at night.'
  )
}

/**
 * The client of ours worth naming on this call.
 *
 * A name in their own trade is the strongest thing a small studio has and it
 * is the one claim the person on the phone can check in a second, so it is
 * only ever said when the row actually carries it. Where it does not, the
 * measured figure stands in — it is true of every site on the list and it is
 * checkable the same way.
 */
function proofLine(row) {
  const work = Array.isArray(row?.proof_work) ? row.proof_work : []
  const named = work
    .slice(0, 2)
    .map(one => (one.town ? `${one.name} in ${one.town}` : one.name))
    .join(' and ')

  if (row?.proof === 'trade' && named) {
    return `We have built for your line of work already, ${named}. Look it up while we talk.`
  }
  if (row?.proof === 'town' && named) {
    return `We built ${named}, right there by you. Have a look at it while we talk.`
  }
  return (
    'We are a small team in Baytown and every site we have built is on ours with the client’s ' +
    `name on it. Google’s own speed test averages ${PORTFOLIO_AVERAGES.mobile} on mobile across ` +
    'them, and you can run it yourself.'
  )
}

/** The ask. One sentence, and it asks for a conversation rather than a sale. */
const ASK =
  'I would like to put you a plan together for what your site would say and what it would cost, ' +
  'for free, with the number agreed before anything starts. Have you got ten minutes ' +
  'this week?'

/**
 * The opening of the call, written out for the business on the screen.
 *
 * Five lines in the order they are said. Each carries what it is for, because
 * a caller reading a script for the fortieth time stops reading the words and
 * starts reading the labels.
 *
 * @param {object} row A drawn call list row.
 * @param {string} [caller] The name whoever is signed in put in Settings.
 * @returns {Array<{id: string, label: string, say: string}>}
 */
export function scriptFor(row, caller) {
  const held = (row?.calls ?? []).some(call => call?.outcome === 'gatekeeper')
  return [
    {
      id: 'greeting',
      label: 'Reach the Owner',
      say: held ? GREETING_AGAIN : GREETING,
    },
    {
      id: 'opener',
      label: 'Introduction',
      say:
        `This is ${saidName(caller)} with ${SITE.shortName}, we build websites for businesses ` +
        'around Baytown and Houston. I am not selling anything over the phone, I am calling about ' +
        'something on your Google listing.',
    },
    { id: 'reason', label: 'Reason for the Call', say: listingLine(row) },
    { id: 'trade', label: 'Their Trade', say: tradeLine(row) },
    { id: 'proof', label: 'Work to Mention', say: proofLine(row) },
    { id: 'ask', label: 'The Ask', say: ASK },
  ]
}

// ── What they ask ──────────────────────────────────────────────────────────

/**
 * The questions that come back down the phone, with the answer said aloud.
 *
 * Every one of these is answered on the site as well, at more length and in
 * the register somebody reads in. These are the spoken versions: shorter,
 * plainer, and each ending somewhere the call can go next rather than at a
 * full stop.
 *
 * The figures are imported rather than typed, so the price a caller quotes and
 * the price the pricing page prints are one string.
 */
export const QUESTIONS = Object.freeze([
  {
    id: 'cost',
    also: ['price', 'pricing', 'quote', 'deposit'],
    ask: 'What does it cost?',
    say:
      `${BUILD_PRICE} up front for the build and ${MONTHLY_PRICE} a month after that, which covers ` +
      'the hosting, the backups, the security, any changes you want, and the search work. Most ' +
      'sites land right there, and if yours needs more you see the number before anything starts.',
  },
  {
    id: 'monthly',
    ask: 'What is the monthly for?',
    say:
      'Hosting, daily backups, security updates, and the search work every month. You text me ' +
      'when a price changes and I change it that day.',
  },
  {
    id: 'contract',
    ask: 'Am I locked into anything?',
    say:
      'No. There is no term to sign and no cancellation fee, and the domain is in your name ' +
      'either way.',
  },
  {
    id: 'how-long',
    also: ['pictures', 'timeline'],
    ask: 'How long does it take?',
    say:
      'Most sites are live in two to four weeks. What usually slows it down is photos, so ' +
      'anything you already have on your phone helps.',
  },
  {
    id: 'what-i-do',
    ask: 'What do you need from me?',
    say:
      'Half an hour on the phone, your logo if you have one, and whatever photos you already ' +
      'have. We write the words and design the thing, and if nothing is ready we build it as we go.',
  },
  {
    id: 'own',
    ask: 'Do I own it?',
    say:
      'The domain is registered in your name, and your words, photos and logo stay yours. We keep ' +
      'the code and the platform it runs on, and the agreement says so in writing.',
  },
  {
    id: 'changes',
    also: ['edit', 'update', 'add a page'],
    ask: 'What if I need to change something?',
    say:
      'Text me. Changes to text and photos are part of the monthly and usually go live the same ' +
      'day, and a new page or a new feature gets a price first.',
  },
  {
    id: 'wordpress',
    also: ['wix', 'squarespace', 'shopify', 'godaddy', 'template'],
    ask: 'Is this WordPress?',
    say:
      'No, every site is written from scratch, so there is no theme to update and no plugin to ' +
      `break it at midnight. Across the sites we have live, Google’s speed test averages ` +
      `${PORTFOLIO_AVERAGES.mobile} on mobile and ${PORTFOLIO_AVERAGES.desktop} on desktop.`,
  },
  {
    id: 'booking',
    ask: 'Can it take bookings or orders?',
    say:
      'Yes, and it is built into the site rather than billed on top of it. Booking, ordering, ' +
      'payments, quote forms, customer logins, whichever of those your shop runs on.',
  },
  {
    id: 'google',
    ask: 'Will it get me on Google?',
    say:
      'That is the point of it. The search work is in place on launch day and worked on every ' +
      'month after, and your Google Business Profile gets set up at the same time.',
  },
  {
    id: 'who',
    ask: 'Who am I actually dealing with?',
    say:
      'Me, and the same small team the whole way through. A year from now you are still calling ' +
      'this number.',
  },
  {
    id: 'where',
    ask: 'Where are you?',
    say:
      'Baytown. Most of our clients are around Houston and the bay, and being close enough to ' +
      'come look at the shop is part of why they picked us.',
  },
])

// ── What they push back with ───────────────────────────────────────────────

/**
 * The eight things said to get off the phone, and what to say back.
 *
 * Each answer concedes the point first. An objection argued with is an
 * objection the caller has told somebody they are wrong about their own
 * business, on their own phone, having called them out of nowhere - and that
 * call is over whatever else gets said.
 *
 * `after` is what to actually do with the call once the answer has landed,
 * because the failure mode here is a caller who wins the exchange and then has
 * no idea what to ask for next.
 */
export const PUSHBACK = Object.freeze([
  {
    id: 'facebook',
    also: ['instagram', 'social media'],
    said: '“I already have a Facebook page.”',
    say:
      'Right, and that is doing something for you, which is why this is worth ten minutes. A ' +
      'Facebook page shows the people who already follow you, and it does not come up when ' +
      'somebody types your trade and your town into Google at eight at night.',
    after: 'Ask what they get from it now. Every answer they give is what the site has to beat.',
  },
  {
    id: 'expensive',
    also: ['expensive', 'pricey', 'cheaper', 'afford', 'budget'],
    said: '“That is too much.”',
    say:
      `Fair enough. The same build gets quoted between ${dollars(MARKET.buildLow)} and ` +
      `${dollars(MARKET.buildHigh)} by an agency, but the number is not the question yet. The ` +
      'question is whether one extra job a month would cover it.',
    after:
      'If the price is genuinely the wall, say so and mark it Not Interested. Do not discount.',
  },
  {
    id: 'busy',
    said: '“I am too busy for this.”',
    say:
      'That is the answer I get from the shops worth calling. It is half an hour of yours, ' +
      'whenever suits, early, late, or at the shop. What is the quietest part of your week?',
    after: 'Take the time they name and record it as a call back. A vague yes is a no.',
  },
  {
    id: 'email',
    said: '“Send me some information.”',
    say:
      'Gladly, what address is best? And so I send you something worth reading, what is the one ' +
      'thing you would want a website to do for you?',
    after:
      'Get the address and the answer before you hang up, then set a call back. An email with no ' +
      'time behind it is a no that took a week.',
  },
  {
    id: 'nephew',
    said: '“My nephew is building me one.”',
    say:
      'Good, that is better than nothing. What usually goes wrong is not the building, it is the ' +
      'year after: who updates it, who is watching when it goes down, who does the Google side. ' +
      'If that lands back on you, call me.',
    after: 'Set a call back six weeks out. Most of these are still not live.',
  },
  {
    id: 'dont-need',
    said: '“I get all my work by word of mouth.”',
    say:
      'That is the best kind of work there is. Somebody who gets your name from a friend still ' +
      'types it into their phone before they call, and right now what they find is a map pin.',
    after: 'This one turns more often than it looks. Ask what happens when somebody searches them.',
  },
  {
    id: 'not-owner',
    also: ['manager', 'wrong person'],
    said: '“I am not the owner.”',
    say: 'No problem. When is the best time to catch them, and is this the right number?',
    after: 'Record it as Gatekeeper with the time they gave you. That is progress, not a miss.',
  },
  {
    id: 'call-back',
    said: '“Call me next week.”',
    say: 'Will do. Is a morning or an afternoon better, and is this the number?',
    after: 'Never leave with “next week”. Get the day and the half of it, then record a call back.',
  },
])

// ── The figures a caller has to have right ─────────────────────────────────

/**
 * The reference card, for the moment somebody asks a number rather than a
 * question.
 *
 * Everything here is either imported from where the site holds it or is a fact
 * about how the studio works. Nothing on this card is a range a caller is
 * meant to pick from.
 */
export const FACTS = Object.freeze([
  { id: 'build', label: 'The Build', value: BUILD_PRICE, note: 'Paid once, before work begins.' },
  { id: 'monthly', label: 'The Monthly', value: MONTHLY_PRICE, note: 'Everything after launch.' },
  { id: 'live', label: 'Live In', value: '2 to 4 weeks', note: 'Photos are what slow it down.' },
  { id: 'term', label: 'Contract', value: 'None', note: 'Stoppable any month, no fee.' },
  {
    id: 'mobile',
    label: 'Speed, Mobile',
    value: String(PORTFOLIO_AVERAGES.mobile),
    note: 'Averaged across the client sites.',
  },
  {
    id: 'desktop',
    label: 'Speed, Desktop',
    value: String(PORTFOLIO_AVERAGES.desktop),
    note: 'Averaged across the client sites.',
  },
  { id: 'plan', label: 'The Plan', value: 'Free', note: 'Nothing is charged to get a number.' },
  {
    id: 'phone',
    label: 'Our Number',
    value: SITE.phone,
    note: 'What to give somebody who wants to call back.',
  },
])

/**
 * Where to send somebody who wants to look while they are on the phone.
 *
 * Whole addresses rather than paths. A caller is reading one of these out, and
 * a console holding the path while leaving the origin to whatever renders it is
 * one deployment away from reading out a link to the console itself.
 */
export const PLACES_TO_SEND = Object.freeze([
  {
    id: 'work',
    label: 'The Work',
    href: `${SITE.origin}/portfolio`,
    note: 'Client sites with the names on them.',
  },
  {
    id: 'pricing',
    label: 'The Price',
    href: `${SITE.origin}/pricing`,
    note: 'The two figures and what they cover.',
  },
  {
    id: 'faq',
    label: 'The Questions',
    href: `${SITE.origin}/faq`,
    note: 'The long version of everything above.',
  },
  {
    id: 'start',
    label: 'Start One',
    href: `${SITE.origin}/start`,
    note: 'Where a yes actually goes.',
  },
])

// ── Closing ────────────────────────────────────────────────────────────────

/**
 * What to do once somebody has said yes, in the order to do it.
 *
 * Written as steps rather than as advice, because this is the part of the call
 * that goes wrong quietly: a caller gets a yes, talks for another ten minutes,
 * and hangs up without an email address.
 */
export const CLOSING = Object.freeze([
  {
    id: 'collect',
    label: 'Before You Hang Up',
    say:
      'Their name, the best email, the best number. Then what the site has to do: take bookings, ' +
      'take orders, or get the phone ringing.',
  },
  {
    id: 'promise',
    label: 'Next Steps',
    say:
      'They get a written plan and a price by email, free. Read it, and if the number ' +
      'works we start.',
  },
  {
    id: 'record',
    label: 'Log the Call',
    say:
      'Booked The Work takes them off the list. Anything short of a yes with a date on it is a ' +
      'call back at the time they gave you, not a booking.',
  },
  {
    id: 'send',
    label: 'After the Call',
    say: `Send the plan the same day. ${SITE.origin}/start is where it goes once they agree.`,
  },
])

// ── Searching it ───────────────────────────────────────────────────────────

/**
 * Whether an entry matches what somebody typed.
 *
 * Every field a person can see is searched, because the words somebody reaches
 * for mid-call are the words in the answer rather than the words in the
 * heading: nobody types "pushback", they type "facebook".
 *
 * `also` is what is searched and never shown. A caller types the word that was
 * said to them, and the answer is often written in the words the studio uses
 * rather than the ones the shop does: the objection here reads "that is too
 * much" and what was actually said down the phone was "expensive". Every one
 * of these leads to an entry that answers the word, so a search that finds
 * nothing still means nothing here answers it.
 *
 * @param {object} entry Any handbook entry.
 * @param {string} typed What is in the search box.
 */
export function handbookMatches(entry, typed) {
  const wanted = String(typed ?? '')
    .toLowerCase()
    .trim()
  if (!wanted) return true
  const hay = [
    entry?.ask,
    entry?.said,
    entry?.say,
    entry?.label,
    entry?.value,
    entry?.note,
    entry?.after,
    ...(entry?.also ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(wanted)
}
