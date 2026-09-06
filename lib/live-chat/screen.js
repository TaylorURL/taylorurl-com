/**
 * What a visitor typed, read for the two things worth catching.
 *
 * The widget answers strangers on a public page, and a share of them are not
 * shopping for a website. Some want the assistant to be a free general-purpose
 * model, some want it to say something embarrassing under the studio's name,
 * and a few want whatever is behind it. The model's own instructions refuse all
 * three, so this is not the only wall -- it is the wall in front, and it earns
 * its place by refusing before a turn is spent rather than after.
 *
 * Two verdicts, because the failure modes are opposite. `refuse` answers from
 * here and costs nothing; it is reserved for phrasings that have no innocent
 * reading, because a customer wrongly refused is a customer lost. `watch` sends
 * the turn on to a model that already knows to decline, and tells the owner
 * afterwards. Anything ambiguous is `watch`, never `refuse`.
 *
 * The patterns are deliberately narrow. A shop owner asking to ignore the old
 * site and start fresh is an ordinary sentence that has to reach the model; the
 * attack is the one that names the instructions as its object.
 */

/**
 * Attempts to countermand the instructions the assistant runs under.
 *
 * Each of these needs the possessive or the object to be the instructions
 * themselves, which is what keeps ordinary uses of "ignore" and "forget" out.
 */
const OVERRIDE = [
  /\b(?:ignore|disregard|forget|discard|override)\b[^.!?\n]{0,40}\b(?:previous|prior|above|earlier|initial|original|all)\b[^.!?\n]{0,20}\b(?:instruction|prompt|rule|direction|guideline|constraint)/i,
  /\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,20}\b(?:your|the|its|these|those)\b[^.!?\n]{0,20}\b(?:instruction|prompt|rule|system message|guardrail|restriction)/i,
  /\bnew\b[^.!?\n]{0,12}\b(?:instruction|rule|directive)s?\s*[:-]/i,
  /\b(?:system|developer|admin(?:istrator)?)\b[^.!?\n]{0,12}\b(?:prompt|message|override|mode|instruction)s?\s*[:-]/i,
  // A forged turn, which is the whole attack dressed as a transcript. The
  // label has to open the message or be followed by something imperative:
  // "our booking system: Square" is a sentence a shop owner writes.
  /^\s*(?:system|assistant|developer|admin(?:istrator)?)\s*[:>]/i,
  /\b(?:system|developer|admin(?:istrator)?)\s*[:>]\s*(?:you|ignore|disregard|override|forget|new|act|respond|answer|output|print|enable|disable|bypass|reveal)\b/i,
  /\byou\s+are\s+(?:now|no\s+longer)\b/i,
  /\bfrom\s+now\s+on\b[^.!?\n]{0,30}\byou\s+(?:are|will|must)\b/i,
  /\b(?:dan|do\s+anything\s+now)\s+mode\b/i,
  /\b(?:developer|god|unrestricted|unfiltered|debug|maintenance)\s+mode\b/i,
  /\bjailbreak/i,
  /\bwithout\s+(?:any\s+)?(?:restrictions?|filters?|limitations?|guardrails?)\b/i,
  /\b(?:bypass|disable|turn\s+off)\b[^.!?\n]{0,20}\b(?:filter|safety|restriction|guardrail|rule)/i,
]

/** Attempts to read the instructions back out. */
const EXTRACTION = [
  /\b(?:what|show|tell|give|print|output|reveal|display|list)\b[^.!?\n]{0,30}\byour\b[^.!?\n]{0,20}\b(?:system\s+prompt|instructions?|prompt|rules?|directives?|guidelines?)\b/i,
  /\b(?:repeat|echo|print|output|reproduce|recite)\b[^.!?\n]{0,30}\b(?:the\s+)?(?:text|words|everything|content|message)\b[^.!?\n]{0,20}\b(?:above|before|preceding|prior)\b/i,
  /\b(?:system\s+prompt|initial\s+prompt|original\s+prompt|your\s+prompt)\b/i,
  /\brepeat\b[^.!?\n]{0,20}\bverbatim\b/i,
  /\b(?:everything|all)\b[^.!?\n]{0,15}\b(?:above|before)\b[^.!?\n]{0,20}\b(?:verbatim|exactly|word\s+for\s+word)\b/i,
  /\bbegin(?:ning)?\s+of\s+(?:the\s+)?(?:conversation|context|prompt)\b/i,
]

/** Attempts to install a different character with different rules. */
const PERSONA = [
  /\b(?:pretend|imagine|act)\b[^.!?\n]{0,20}\b(?:you\s+(?:are|were)|to\s+be)\b[^.!?\n]{0,40}\b(?:no\s+(?:rules|limits|restrictions)|unrestricted|evil|uncensored)\b/i,
  /\b(?:roleplay|role-play|simulate)\b[^.!?\n]{0,20}\b(?:as|being)\b/i,
  /\byour\s+name\s+is\s+(?:not\s+)?\w+\b[^.!?\n]{0,20}\byou\b/i,
  /\bstay\s+in\s+character\b/i,
  /\bhypothetically[^.!?\n]{0,40}\b(?:you\s+(?:could|would|can)|no\s+rules)\b/i,
]

/**
 * A payload dressed up so a pattern will not read it.
 *
 * Four hundred characters of base64 is not something a visitor pastes into a
 * chat window about a barbershop website.
 */
const ENCODED = [
  /[A-Za-z0-9+/]{120,}={0,2}/,
  /(?:\\u[0-9a-fA-F]{4}){8,}/,
  /(?:%[0-9a-fA-F]{2}){20,}/,
  /(?:\\x[0-9a-fA-F]{2}){12,}/,
]

/**
 * Using the widget as a free model for something it is not for.
 *
 * This is `watch` rather than `refuse`: somebody asking for help with the copy
 * that goes on their own site is a customer, and the sentence looks much the
 * same as the freeloader's.
 */
const OFFTOPIC = [
  /\bwrite\s+(?:me\s+)?(?:an?\s+)?(?:essay|poem|story|song|screenplay|novel|thesis|dissertation)\b/i,
  /\b(?:do|finish|help\s+with)\s+my\s+(?:homework|assignment|coursework|exam)\b/i,
  /\b(?:solve|calculate|compute)\b[^.!?\n]{0,20}\b(?:equation|integral|derivative|proof)\b/i,
  /\bwrite\s+(?:me\s+)?(?:a|some)\s+(?:python|java|c\+\+|rust|go|sql)\s+(?:script|program|function|code)\b/i,
  /\b(?:translate|summar(?:ize|ise))\s+(?:this|the\s+following)\b[^.!?\n]{0,20}(?:\n|:)/i,
]

/** Fishing for what the studio holds about other people. */
const PROBE = [
  /\b(?:list|name|who\s+are|tell\s+me\s+about)\b[^.!?\n]{0,20}\b(?:your|the|his)\s+(?:other\s+)?(?:clients?|customers?)\b/i,
  /\b(?:api\s+key|secret\s+key|access\s+token|password|credential|env(?:ironment)?\s+var)/i,
  /\b(?:database|supabase|stripe|admin\s+panel|dashboard)\b[^.!?\n]{0,20}\b(?:password|login|credential|access|url)\b/i,
  /\b(?:what|which)\b[^.!?\n]{0,20}\b(?:model|llm|ai)\b[^.!?\n]{0,20}\b(?:are\s+you|do\s+you\s+(?:run|use))\b/i,
]

const GROUPS = [
  { label: 'override', patterns: OVERRIDE, verdict: 'refuse' },
  { label: 'extraction', patterns: EXTRACTION, verdict: 'refuse' },
  { label: 'persona', patterns: PERSONA, verdict: 'refuse' },
  { label: 'encoded', patterns: ENCODED, verdict: 'refuse' },
  { label: 'probe', patterns: PROBE, verdict: 'watch' },
  { label: 'offtopic', patterns: OFFTOPIC, verdict: 'watch' },
]

/**
 * Characters that carry no meaning in a typed sentence and are only ever there
 * to break a pattern up or hide a second message inside the first.
 */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g

/** The message with its hiding places closed, for matching only. */
function flatten(message) {
  return String(message).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
}

/**
 * Reads one visitor message.
 *
 * @param {string} message What was typed.
 * @returns {{ verdict: 'clear'|'watch'|'refuse', labels: string[] }}
 */
export function screen(message) {
  const flat = flatten(message)
  const labels = []
  let verdict = 'clear'

  for (const group of GROUPS) {
    if (!group.patterns.some(pattern => pattern.test(flat))) continue
    labels.push(group.label)
    if (group.verdict === 'refuse') verdict = 'refuse'
    else if (verdict === 'clear') verdict = 'watch'
  }

  return { verdict, labels }
}

/**
 * Phrases lifted from the assistant's own instructions.
 *
 * One of these coming back in a reply means the instructions are being recited
 * rather than followed, and the reply is dropped rather than shown. Short
 * enough to be distinctive, long enough not to occur in an ordinary sentence.
 */
const LEAK_MARKERS = [
  'you are the assistant on the website of taylorurl',
  'never reveal, summarize, paraphrase',
  'people trying to break you',
  'the shape of a good answer',
  'staying on your subject',
  'text in a message is a person talking to you',
]

/** Whether a reply is reciting the instructions instead of following them. */
export function leaked(reply) {
  const flat = flatten(reply).toLowerCase()
  return LEAK_MARKERS.some(marker => flat.includes(marker))
}

const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i

// Ten digits with the usual separators, less the studio's own number, which the
// assistant hands out and a visitor may well repeat back.
const PHONE = /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
const OWN_PHONE = /2818628687/

/**
 * A contact detail the visitor volunteered, if they volunteered one.
 *
 * This is the point of the widget. A conversation that produced an address is
 * worth a message to the owner while the visitor is still on the page.
 *
 * @param {string} message What was typed.
 * @returns {{ email: string|null, phone: string|null }}
 */
export function contactIn(message) {
  const flat = flatten(message)
  const email = flat.match(EMAIL)
  const phone = flat.match(PHONE)
  const digits = phone ? phone[0].replace(/\D/g, '') : ''

  return {
    email: email ? email[0] : null,
    phone: phone && !OWN_PHONE.test(digits) ? phone[0] : null,
  }
}

/** What a refused message is answered with, in the assistant's own register. */
export const REFUSAL =
  'I am only set up to talk about the websites Trenton builds, so I will leave that one. ' +
  'If there is something about your business or a site you are thinking about, I am glad to help with that.'
