/**
 * What no line of type on a card may carry, wherever the card is drawn.
 *
 * Two renderers draw in the studio's sheet: `render-media.js`, which writes the
 * library into the repository, and `generated-cards.js`, which draws review,
 * proof and launch cards and launch videos from live data on the Pi. Both read
 * every page's text back out of the browser after layout and hold it to the
 * rules below, and they hold it to this one copy of them. A second copy is a
 * rule that gets tightened in one place and goes on passing in the other, and
 * the card that slips through is the one drawn unattended.
 *
 * Nothing here throws on its own account except `guard` and `altGuard`, which
 * are the renderers' refusals. `faults` answers what it found instead, so a
 * caller choosing between candidate lines - which sentence of a review to quote
 * - can ask about each one without catching anything.
 */
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'

/**
 * Every way a client could be named in a line of copy: the business name, its
 * first word and first two words, the host it is served from and the host's
 * stem. The first word is matched as a whole word and in its own case, so
 * "Compound" the business is caught and "compound" the adjective would not be.
 * The extra names are ones the articles print beside a client: a parent company
 * and an owner's first name.
 */
function clientPatterns() {
  const terms = new Set(['SRM', 'Angie', 'go-kart', 'TX-146'])
  const loose = new Set()
  for (const project of PORTFOLIO_PROJECTS.filter(entry => entry.kind === 'client')) {
    const parts = project.name.split(/\s+/)
    terms.add(project.name)
    terms.add(parts[0])
    if (parts.length > 1) terms.add(parts.slice(0, 2).join(' '))
    const host = project.displayUrl.replace(/^www\./, '')
    loose.add(host)
    loose.add(host.split('.')[0])
  }
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    ...[...terms].map(term => ({
      term,
      re: new RegExp(`(^|[^A-Za-z0-9])${escape(term)}(?![A-Za-z0-9])`),
    })),
    ...[...loose].map(term => ({ term, re: new RegExp(escape(term), 'i') })),
  ]
}

const CLIENTS = clientPatterns()

/**
 * What no line may carry. `voice` marks the rules about who is speaking, which
 * a business name the client gave is not: "My Pool Guy" is a name, not the
 * studio saying "my".
 */
const RULES = [
  { why: 'a price', re: /\$\s?\d|\b\d[\d,]*\s?dollars?\b|\bstarting at\b|\bfrom \$|\bUSD\b/i },
  {
    why: 'first-person voice',
    re: /(^|[^A-Za-z-])(I|I'm|I've|I'll|I'd)(?![A-Za-z'’-])/,
    voice: true,
  },
  { why: 'first-person voice', re: /\b(me|my|mine|myself)\b/i, voice: true },
  { why: 'solo framing', re: /\bone[- ]person\b|\bsolo\b/i, voice: true },
  { why: 'an emoji', re: /\p{Extended_Pictographic}/u },
  { why: 'an em dash', re: /—/ },
  { why: 'a value that never resolved', re: /\b(undefined|null|NaN)\b/ },
]

/** Spacing and punctuation an alt built from parts can come out with. */
const ALT_RULES = [
  { why: 'a space before punctuation', re: /\s[.,;:?!]/ },
  { why: 'a doubled stop', re: /[.?!]\./ },
  { why: 'a stop inside a sentence', re: /\d%\.\s+[a-z]/ },
]

/**
 * The text with every name it is allowed to carry taken out.
 *
 * A launch post the client said yes to names their business, and that business
 * is, or will be, one of the clients the guard exists to keep off a card. So a
 * caller holding that yes names the business here, and exactly those strings are
 * lifted out before the client and voice rules read the text. Nothing looser is
 * lifted: a first word or a host standing on its own is still caught, and every
 * other client on the list is still refused, so a yes from one client never
 * lets another one's name through.
 */
const without = (text, allow) =>
  allow.filter(Boolean).reduce((rest, name) => rest.split(name).join(' '), text)

/**
 * Everything a line of type is refused for, or an empty list where it is clean.
 *
 * @param {string} text One line, or a whole page's text run together.
 * @param {object} [options]
 * @param {string[]} [options.allow] Names this line may carry, exactly as written.
 * @returns {string[]} Each fault, naming what matched.
 */
export function faults(text, { allow = [] } = {}) {
  const found = []
  const spoken = without(text, allow)
  for (const { term, re } of CLIENTS) if (re.test(spoken)) found.push(`client name "${term}"`)
  for (const { why, re, voice } of RULES) {
    const read = voice ? spoken : text
    if (re.test(read)) found.push(`${why} (${read.match(re)[0].trim()})`)
  }
  return found
}

/** The faults an alt or a headline can have on top of `faults`. */
export function altFaults(text) {
  return ALT_RULES.filter(({ re }) => re.test(text)).map(
    ({ why, re }) => `${why} ("${text.match(re)[0]}")`
  )
}

/** Refuses a page's text that carries anything `faults` names. */
export function guard(key, text, options = {}) {
  const found = faults(text, options)
  if (found.length)
    throw new Error(`render-media: ${key} carries ${found.join(', ')}:\n  ${text.slice(0, 400)}`)
}

/** An alt or a headline: every guard above, plus the ones a joined string can fail. */
export function altGuard(key, text, options = {}) {
  guard(key, text, options)
  const found = altFaults(text)
  if (found.length)
    throw new Error(`render-media: ${key} alt has ${found.join(', ')}:\n  ${text.slice(0, 400)}`)
}
