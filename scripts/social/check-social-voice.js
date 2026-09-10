/**
 * Holds everything this account can publish to the three rules in `voice.js`.
 *
 * The studio is more than one person, and a post written as "I build" says
 * otherwise to every reader who meets it. The other checks in this folder
 * answer whether a post can be placed at all — the right metadata, a card the
 * site serves, a slot inside the horizon — and none of them read the words.
 * This one reads nothing else.
 *
 * A scheduled post is out of reach the moment it publishes, and the queue runs
 * unattended five days a week, so the wording is checked on the pull request
 * rather than in the account. The price is checked twice over: here, and again
 * in `social.js post`, which is the one gate a post the routine composed passes
 * through before Buffer holds it. The strings held here are every string a run
 * can publish without a person writing it: the card alt text Buffer requires,
 * and the frame an article's own announcement is composed inside. What a person
 * writes by hand is theirs to get right, and the routine's own prompt carries
 * the same three rules for the posts it composes.
 *
 *   npm run check:social-voice
 */
import { CADENCE } from '../../lib/social/buffer.js'
import { CARDS } from '../../lib/social/cards.js'
import { articleUrl, hasCopy, postText } from '../../lib/social/announce.js'
import {
  MAX_SENTENCES,
  firstPerson,
  misquotedPrices,
  sentenceCount,
} from '../../lib/social/voice.js'
import { BUILD_PRICE, MONTHLY_PRICE } from '../../src/app/data/checkout/pricing.js'

// The same article the post checks compose against, so a failure here and a
// failure there are about the same post rather than about two different ones.
const ARTICLE = {
  slug: 'what-a-plumbers-website-has-to-do',
  title: "What a Plumber's Website Actually Has to Do",
  excerpt:
    'A plumber wins work in the hour after somebody finds water where it should not be. ' +
    'The site either answers that call or it loses it to the next one down the page.',
}

const failures = []
let checks = 0

function check(what, ok) {
  checks += 1
  if (!ok) failures.push(what)
}

/** A post held to all three rules at once, named by where it came from. */
function holds(where, text) {
  const found = firstPerson(text)
  check(`${where}: written as one person, on ${found.join(', ')}`, found.length === 0)
  const count = sentenceCount(text)
  check(`${where}: ${count} sentences, and the ceiling is ${MAX_SENTENCES}`, count <= MAX_SENTENCES)
  const stale = misquotedPrices(text)
  check(
    `${where}: quotes ${stale.map(one => one.found).join(', ')}, and the site publishes ` +
      stale.map(one => one.published).join(', '),
    stale.length === 0
  )
}

// The rule itself, before anything is measured against it. A counter that
// stopped counting would pass every post in the queue silently, which is the
// one failure mode a check like this has.
{
  check(
    'a headline and an address cost nothing',
    sentenceCount('Be the one they call\n\nhttps://www.taylorurl.com') === 0
  )
  check(
    'a sentence is counted',
    sentenceCount('Be the one they call\n\nThe site either answers or it does not.') === 1
  )
  check('a paragraph is counted by its sentences', sentenceCount('One. Two. Three. Four.') === 4)
  check(
    'a phone sign-off costs nothing',
    sentenceCount('Call or text (281) 862-8687\nhttps://www.taylorurl.com/contact') === 0
  )
  check('the pronoun is caught', firstPerson('I build the websites.').length === 1)
  check('the possessive is caught', firstPerson('Sites I look after.').length === 1)
  check(
    'a solo phrasing with no pronoun is caught',
    firstPerson('A one-person studio.').length === 1
  )
  check('ordinary copy is left alone', firstPerson('We build the websites.').length === 0)

  // The price rule, against the figures the site actually publishes rather
  // than against a number typed here, so this block cannot be the thing that
  // remembers an old price.
  check(
    'a stale monthly is caught',
    misquotedPrices('Everything included, for $99 a month.')[0]?.published === MONTHLY_PRICE
  )
  check(
    'the monthly the site publishes is left alone',
    misquotedPrices(`Everything included, from ${MONTHLY_PRICE} a month.`).length === 0
  )
  check(
    'a stale build is caught',
    misquotedPrices('A site is $1,500 up front.')[0]?.published === BUILD_PRICE
  )
  check(
    'the build the site publishes is left alone',
    misquotedPrices(`A site is from ${BUILD_PRICE} up front.`).length === 0
  )
  check(
    'a figure written without its comma still matches',
    misquotedPrices(`A site is $${BUILD_PRICE.replace(/[$,]/g, '')} up front.`).length === 0
  )
  check('the shorthand month is read as a month', misquotedPrices('$99/mo, all in.').length === 1)
  check(
    'a figure that is no price claim of ours is left alone',
    misquotedPrices('Two and a half hours of racing for $49.99 a person.').length === 0
  )
  check(
    'the band the pricing page compares against is left alone',
    misquotedPrices('Studios quote $150 to $500 a month for the same care.').length === 0
  )
}

// Every card's alt text. Buffer requires one on every image, so this is copy
// that publishes on every Instagram post whether or not anybody reread it.
for (const card of CARDS) {
  holds(`${card.key} alt`, card.alt)
}

// Every announcement, composed. The article's own title and excerpt are not
// the studio's words and are exempt from the voice rule — an author is free to
// write "I" in a piece — but the post they end up inside is still held to the
// ceiling as a whole.
for (const [service, cadence] of Object.entries(CADENCE)) {
  if (cadence.announces === false || !hasCopy(service)) continue

  const text = postText(service, ARTICLE)
  const count = sentenceCount(text)
  check(
    `${service}: announcement runs to ${count} sentences, and the ceiling is ${MAX_SENTENCES}`,
    count <= MAX_SENTENCES
  )

  const frame = text.replace(ARTICLE.title, '').replace(articleUrl(ARTICLE), '')
  const written = frame
    .split('\n')
    .filter(line => !ARTICLE.excerpt.includes(line.trim()))
    .join('\n')
  const found = firstPerson(written)
  check(
    `${service}: announcement written as one person, on ${found.join(', ')}`,
    found.length === 0
  )
}

// A long excerpt gives way to the ceiling rather than overrunning it. The
// character limit used to be the only thing trimming an excerpt, so an article
// with a short one and a long one composed two posts of quite different
// lengths and nothing said so.
{
  const long = {
    ...ARTICLE,
    excerpt: Array.from(
      { length: 20 },
      (unused, index) => `A plumber wins the job in the hour after the call, and that is ${index}.`
    ).join(' '),
  }
  for (const [service, cadence] of Object.entries(CADENCE)) {
    if (cadence.announces === false || !hasCopy(service)) continue
    const count = sentenceCount(postText(service, long))
    check(`${service}: a long excerpt makes a ${count} sentence post`, count <= MAX_SENTENCES)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  console.error(`\n${failures.length} of ${checks} social voice checks failed`)
  process.exit(1)
}

console.log(
  `social voice: ${checks} checks, ${CARDS.length} cards, ceiling ${MAX_SENTENCES}, ` +
    `price ${BUILD_PRICE} and ${MONTHLY_PRICE}`
)
