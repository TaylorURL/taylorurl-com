/**
 * What to say on the call, and what to say back.
 *
 * The call list next door answers who to ring and in what order, and it stops
 * exactly where the phone starts ringing. Everything past that point was
 * carried in one person's head: the opening line, what the monthly covers, what
 * to say to somebody who already has a Facebook page and cannot see what is
 * wrong with it. A list that hands a caller a number and nothing else is a list
 * that only works for the person who built it.
 *
 * THE FIRST CALL SELLS NOTHING. It has one goal and the whole handbook is bent
 * around it: the owner says yes to a free audit of their own listing, and names
 * a time the same day to be walked through it. So a caller asks for four things
 * and hangs up - the yes, what the owner wants the site to do, an address or a
 * mobile number for the link, and the time. The audit team builds the audit and
 * works the figure out from how complicated the site has to be, and the caller
 * rings back the same day, next morning at the latest, with the owner reading
 * the audit on the site while they talk. Nothing is quoted on a first call and
 * no caller ever says a dollar figure out loud, on either call: the number is
 * read off the audit in front of them rather than guessed at over the phone.
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
 * THE ANSWERS ARE FIXED. What the monthly buys, who owns the domain, how long a
 * build takes - a caller who improvises those is a caller who contradicts the
 * last one by Tuesday. A build is worked out for the job it is, so the answer
 * to what it costs is that the audit works it out and the call back carries it.
 *
 * THE PUSHBACK IS THE PART THAT IS ACTUALLY HARD. A dozen objections cover
 * nearly every call that does not end at a voicemail, and the answer to each is
 * a sentence rather than a rebuttal - what is being asked for is thirty seconds
 * and a free audit, not an argument won with somebody at their own counter.
 *
 * Strings and pure functions only. This is imported into the browser bundle
 * beside `calls.js`, so a database, a network call or a date formatter here
 * would break that bundle the way it would break its neighbour's.
 */

import { PORTFOLIO_AVERAGES } from '../../../src/app/data/portfolio.js'
import { SITE } from '../../site/current.js'
import { platformName, hostOf } from './platforms.js'
import { presenceOf, reviewsOf } from './calls.js'

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
  { id: 'facts', label: 'Facts' },
  { id: 'close', label: 'Closing' },
])

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
 * It is written for the caller to say rather than to read, so it has to sound
 * like somebody who looked them up two minutes ago, because that is what it is.
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
 * The number is the same one the score is built on, and the list leads with
 * the businesses furthest behind their trade, so on most calls this is the
 * line that says why the phone rang: the shops they compete with get found and
 * they do not.
 *
 * The count is read the way the score reads it, so a listing Google answered
 * for with no reviews on it is told it has none rather than that its trade
 * could not be measured.
 */
function tradeLine(row) {
  const count = reviewsOf(row)
  const median = row?.trade_median
  const trade = row?.trade || 'your line of work'
  if (count === null || median === null || median === undefined) {
    return (
      `Google has too few ${trade} listings around here for me to measure you against. What I can ` +
      'see is that there is nowhere for the people looking for you to land.'
    )
  }
  const middle = Math.round(median)
  const held =
    count === 0 ? 'no reviews on Google yet' : count === 1 ? '1 review' : `${count} reviews`
  if (row?.pull === 'busy') {
    return (
      `You have ${held} and the middle for ${trade} listings around here is about ` +
      `${middle}, so you are well ahead of the shops you compete with. The ones with a website ` +
      'are still getting found ahead of you.'
    )
  }
  if (row?.pull === 'quiet') {
    return (
      `You have ${held} and the middle for ${trade} listings around here is about ` +
      `${middle}. That is what happens when there is nowhere for people to find you and nothing ` +
      'asking them to leave one.'
    )
  }
  return (
    `You have ${held}, about where most ${trade} listings sit around here. The shops ` +
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

/**
 * The ask, and the only thing the first call is for.
 *
 * It asks for two things in one breath and nothing else: the yes to a free
 * audit, and a time today to go through it. Both halves have to be in the
 * sentence, because a yes with no time on it is the call that quietly goes
 * nowhere - the audit gets built, the caller rings back into a voicemail, and
 * the owner has forgotten agreeing to anything.
 *
 * No plan and nothing by email. A caller asking for ten minutes this week was
 * asking somebody to give up an appointment before they had seen a reason to,
 * and the free audit is the reason: it is a reading of their own listing, it
 * costs them thirty seconds to agree to, and the second call is the one that
 * has something to talk about.
 */
const ASK =
  'Let me run you a free audit of what people find when they look for you, and then ring you ' +
  'back later today to walk you through it. Have you got thirty seconds to set that up?'

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
 * No figure is said. A build is worked out for the job it is and the audit is
 * what works it out, so what a caller gives back is that the number comes on
 * the call back with the audit in front of them.
 */
export const QUESTIONS = Object.freeze([
  {
    id: 'audit',
    also: ['report', 'review my site'],
    ask: 'What is the audit?',
    say:
      'It is a reading of what somebody finds when they look for you: what comes up, how fast it ' +
      'loads, what is missing, and where you sit against the shops you compete with. You read it ' +
      'on our site while we talk.',
  },
  {
    id: 'cost',
    also: ['price', 'pricing', 'quote', 'deposit'],
    ask: 'What does it cost?',
    say:
      'It depends on what the site has to do, so I work the number out for your job rather than ' +
      'read it off a list. That is what the audit settles, and it comes to you in writing with ' +
      'the figure on it before we talk again.',
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
 * The dozen things said to get off the phone, and what to say back.
 *
 * Each answer concedes the point first. An objection argued with is an
 * objection the caller has told somebody they are wrong about their own
 * business, on their own phone, having called them out of nowhere - and that
 * call is over whatever else gets said.
 *
 * Every one of them lands back on the same two things, because the first call
 * wants nothing else: the yes to the audit, and a time today. That is what
 * makes these answerable at all. An objection to a price is unanswerable
 * without a number and a number is the one thing a caller does not have, but an
 * objection to thirty seconds and a free reading of their own listing is a
 * different conversation, and it is the one being had.
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
      'Right, and that is doing something for you. A page reaches the people who already follow ' +
      'you, and the audit shows you what everybody else sees when they type your trade into ' +
      'Google at eight at night.',
    after:
      'Ask what they get from the page now. That answer is what the audit has to beat, so put it ' +
      'in the note.',
  },
  {
    id: 'how-much',
    also: ['ballpark', 'rough idea'],
    said: '“How much does it cost?”',
    say:
      'It depends on how complicated the site has to be, and working that out is exactly what the ' +
      'audit does. I will have the figure on it in front of you when I ring you back.',
    after:
      'Never guess a number. Get the yes and the time, and the figure comes with the audit on the ' +
      'call back.',
  },
  {
    id: 'expensive',
    also: ['expensive', 'pricey', 'cheaper', 'afford', 'budget'],
    said: '“That is too much.”',
    say:
      'Fair enough, and nothing is quoted yet. The audit works the figure out from what your site ' +
      'has to do, and you see it in writing before anybody asks you for anything.',
    after:
      'Book the audit anyway. If the figure is genuinely the wall once they have seen it, that is ' +
      'the call to mark Not Interested.',
  },
  {
    id: 'email',
    also: ['later', 'information', 'brochure'],
    said: '“Just send me an email.”',
    say:
      'I can do that, what is the best address? The audit goes to you there, and I will ring you ' +
      'at a set time to go through it rather than leave you reading it on your own.',
    after:
      'Get the address and the time in the same breath, then log it as Audit Booked. Email Client ' +
      'This Audit only works for a business whose audit is already on file; where there is none ' +
      'the audit team builds it first.',
  },
  {
    id: 'no-email',
    also: ['privacy', 'spam', 'junk'],
    said: '“I do not want to give you my email.”',
    say:
      'Understood, a mobile number does the same job. I text you the link to the audit and ' +
      'nothing else ever goes to that number.',
    after:
      'Take the mobile and read it back to them. If they will give neither, it is a call back ' +
      'rather than an audit.',
  },
  {
    id: 'no-computer',
    also: ['laptop', 'ipad'],
    said: '“I will not be near a computer.”',
    say:
      'The audit reads fine on a phone. Give me the best mobile and I will text you the link ' +
      'before I ring, or pick a time when you are sat at a screen.',
    after: 'Take the mobile or the time, not neither. Whichever they give goes in the note.',
  },
  {
    id: 'today-no-good',
    also: ['tomorrow', 'next week', 'another day'],
    said: '“Today does not work.”',
    say:
      'That is fine, first thing in the morning then. The audit will be ready and waiting, and it ' +
      'needs ten minutes and a screen in front of you.',
    after:
      'The next morning is the latest it ever goes. A yes with no time on it is a no, so get the ' +
      'hour before you hang up.',
  },
  {
    id: 'busy',
    also: ['no time', 'in a rush', 'slammed'],
    said: '“I am busy.”',
    say:
      'That is the answer I get from the shops worth calling. Setting the audit up is thirty ' +
      'seconds, and going through it is ten minutes at a time you pick.',
    after: 'Get the yes and a time today, then let them go. Record it as Audit Booked.',
  },
  {
    id: 'nephew',
    also: ['my son', 'my guy', 'someone already'],
    said: '“My nephew is building me one.”',
    say:
      'Good, that is better than nothing. The audit is free either way, so you will know what to ' +
      'hold him to when he shows you what he has built.',
    after: 'Set a call back six weeks out. Most of these are still not live.',
  },
  {
    id: 'dont-need',
    also: ['referrals', 'repeat customers'],
    said: '“I get all my work by word of mouth.”',
    say:
      'That is the best kind of work there is. Somebody who gets your name from a friend still ' +
      'types it into their phone first, and the audit shows you what they find when they do.',
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
    also: ['another time', 'not now'],
    said: '“Call me next week.”',
    say:
      'Will do. The audit only takes today, so let me get it done and ring you in the morning ' +
      'rather than leave it a week.',
    after:
      'Never leave with “next week”. Get the hour in the morning, then record it as Audit Booked.',
  },
])

// ── The figures a caller has to have right ─────────────────────────────────

/**
 * The reference card, for the moment somebody asks a number rather than a
 * question.
 *
 * Everything here is either read from where the site holds it or is a fact
 * about how the studio works. Nothing on this card is a range a caller is
 * meant to pick from, and no dollar figure appears on it at all.
 *
 * The build and the monthly are the two a caller is asked for most and they
 * both read the same way on purpose: the job decides, and the audit is what
 * reads the job. That is what the free entry beside them is for, and it is the
 * only thing on this card a caller offers somebody unprompted.
 */
export const FACTS = Object.freeze([
  {
    id: 'build',
    label: 'The Build',
    value: 'Per Project',
    note: 'Worked out for the job, in writing.',
  },
  {
    id: 'monthly',
    label: 'The Monthly',
    value: 'Per Project',
    note: 'Hosting, changes, and the search work.',
  },
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
  {
    id: 'audit',
    label: 'The Audit',
    value: 'Free',
    note: 'The figure comes with it, on the call back.',
  },
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
 * Where the owner reads the audit, said the way somebody about to type it hears
 * it.
 *
 * Derived off the origin rather than written out, because the scheme and the
 * www are not said aloud and a handbook holding its own spelling of the address
 * is one deployment away from reading out a domain the site does not answer on.
 */
const SAID_SITE = SITE.origin.replace(/^https?:\/\//, '').replace(/^www\./, '')

/**
 * What to do once somebody has said yes to the audit, in the order to do it.
 *
 * Written as steps rather than as advice, because this is the part of the call
 * that goes wrong quietly: a caller gets a yes, talks for another ten minutes,
 * and hangs up with no address and no time. An audit nobody can send and nobody
 * is expecting is the same as no audit, and it took a caller and an owner ten
 * minutes each to arrive at.
 *
 * The close is the first call's close. Everything about the money happens on
 * the second one, with the audit open in front of the owner, which is why the
 * last two steps are about handing the call over rather than about closing it.
 */
export const CLOSING = Object.freeze([
  {
    id: 'collect',
    label: 'Before You Hang Up',
    say:
      'What they want the site to do: take bookings, take orders, or get the phone ringing. Then ' +
      'an email or a mobile number for the audit link, and the time you are ringing them back.',
  },
  {
    id: 'promise',
    label: 'Book the Callback',
    say:
      'Today, at a time they will be near a screen, because they have to read the audit while ' +
      'you talk. Next morning at the latest, and never later than that.',
  },
  {
    id: 'record',
    label: 'Log the Call',
    say:
      'Audit Booked, with the time on it. A yes with no time is a Call Back rather than a ' +
      'booking, and Booked The Work is only for a job somebody has signed.',
  },
  {
    id: 'send',
    label: 'After the Call',
    say:
      'The audit team builds it and works the figure out. On the call back you send the link ' +
      `first and get them reading it on ${SAID_SITE}, then take them through the scores, what is ` +
      'wrong, what they asked for, the fix and the number.',
  },
  {
    id: 'email-audit',
    label: 'Email Client This Audit',
    say:
      'Only for a business whose audit is already on file, and only to an address the owner gave ' +
      'you. Log the callback first, because the message tells them when you ring. The screen ' +
      'asks you to confirm the address twice before it sends, and then says who sent it and ' +
      'when so nobody sends it twice.',
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
