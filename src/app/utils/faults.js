/**
 * One plain sentence for anything that went wrong.
 *
 * Every failure on this site arrives written for somebody else. Supabase
 * answers a bad sign-in with `Invalid login credentials`, Postgres with
 * `duplicate key value violates unique constraint`, a dropped connection with
 * `TypeError: Failed to fetch`, and an upstream service with whatever JSON it
 * felt like — the presence check once put `The measurement service answered
 * 500. { "error": { "code": 500, "message": "Lighthouse returned error:` under
 * the address field of a page written for a plumber. None of those are wrong;
 * they are all addressed to a programmer, and the person reading them is not
 * one. What they take from it is that the site is broken and they did
 * something to break it.
 *
 * So nothing a service says reaches a reader unread. A message passes through
 * this on its way to the screen, and comes out as one sentence in the site's
 * own voice: what happened, and what to do about it. The order below is the
 * whole of the rule.
 *
 *   1. A cause we recognise gets the sentence written for it. This is where
 *      almost everything lands, because the failures a person actually meets
 *      are a short list — a wrong password, an address already signed up, a
 *      link that expired, a connection that dropped, a service being asked too
 *      quickly.
 *   2. A cause we do not recognise, but which reads as though a person wrote
 *      it, is passed through. The endpoints in `api/` write for readers on
 *      purpose, and a sentence one of them chose is better than a general one
 *      chosen here.
 *   3. Anything else is replaced. Not summarised, not truncated — replaced,
 *      because a machine sentence cut to eighty characters is still a machine
 *      sentence, and the half that survives is the least useful half.
 *
 * Nothing here decides what is *shown*. A per-field rule ("enter an email in
 * the form name@example.com") belongs under its field, wired to the input by
 * `aria-describedby`, and stays there. This is for the failures that are not
 * about one field: the server, the network, the account, the unexpected.
 */

/**
 * What a reader is told when the cause is unrecognised and unreadable. It says
 * the two true things — nothing was lost, trying again is reasonable — without
 * claiming to know which of a hundred things happened.
 */
export const FALLBACK_FAULT = 'That did not go through. Nothing was lost, so try it again.'

const OFFLINE = 'The connection dropped before that finished. Check you are online and try again.'
const SLOW = 'That took too long to answer. Give it a moment and try again.'
const SIGNED_OUT = 'You are not signed in any more. Sign in and try that again.'
const NOT_ALLOWED = 'This account is not allowed to do that.'
const TOO_FAST = 'That is being asked for too quickly. Wait a minute and try again.'
const SERVER =
  'The server had trouble with that. It is not something you did, so try again shortly.'

/**
 * The causes a person actually meets, and the sentence each one gets.
 *
 * Matched against the lowercased text of whatever was thrown, in order, so the
 * specific rules sit above the general ones. Every sentence says what to do
 * next, because a failure a reader cannot act on is a dead end however kindly
 * it is worded.
 */
const KNOWN = [
  // The account. Supabase answers a wrong address and a wrong password with
  // one message on purpose — telling them apart tells a stranger which
  // addresses hold accounts — and the sentence keeps that property.
  [
    /invalid login credentials|invalid_credentials|user not found|user_not_found/,
    'That email and password do not match an account. Check both and try again.',
  ],
  [
    /email not confirmed|email_not_confirmed/,
    'This account still needs confirming. Open the link in the email sent when it was made.',
  ],
  [
    /already (?:been )?registered|user_already_exists|email_exists/,
    'There is already an account on that address.',
  ],
  [/password should be at least|weak_password/, 'That password is too short. Use a longer one.'],
  [
    /new password should be different|same_password/,
    'That is the password already on the account. Choose a different one.',
  ],
  [
    /token has expired|email link is invalid|otp_expired|invalid or has expired/,
    'That link has expired. Ask for a new one and use the newest email.',
  ],
  [
    /invalid.*(totp|one-time password)|mfa_verification_failed/,
    'That code was not accepted. Check the authenticator app and type the six digits showing now.',
  ],
  [
    /unable to validate email address|invalid format/,
    'Enter an email address in the form name@example.com.',
  ],
  [
    /signups not allowed|signup_disabled/,
    'New accounts are closed at the moment. Get in touch and we will open one.',
  ],
  [
    /for security purposes.*after \d+ seconds|over_request_rate_limit/,
    'That was just asked for. Wait a moment and try again.',
  ],
  [
    /email rate limit|over_email_send_rate_limit/,
    'Too many emails have gone to that address just now. Try again in a few minutes.',
  ],
  [/jwt expired|session_not_found|refresh_token|session missing/, SIGNED_OUT],

  // The database, when a write reaches it and is refused.
  [/duplicate key value|unique constraint/, 'That one is already on the list.'],
  [/row-level security|permission denied|insufficient_privilege|pgrst301/, NOT_ALLOWED],
  [
    /violates foreign key|violates check constraint/,
    'That value is not one this field takes. Check it and try again.',
  ],

  // The network, which is the failure a person is most likely to be able to do
  // something about, and the one least likely to say so in its own words.
  [/failed to fetch|networkerror|load failed|err_internet_disconnected|err_network/, OFFLINE],
  [/aborted|timeout|timed out|etimedout|deadline exceeded/, SLOW],

  // The picture tools, where the browser refuses the drawing surface itself.
  // A reader who has loaded somebody else's logo off the web meets this one,
  // and the browser's own words for it name a policy rather than a thing to do.
  [
    /canvas|tainted|cross-origin|securityerror/,
    'That image could not be worked on here. Download it and upload it from your own machine.',
  ],

  // The clipboard, which a browser refuses on its own terms and only ever
  // inside a gesture it did not see.
  [
    /notallowederror|clipboard/,
    'This browser would not take that to the clipboard. Select it and copy it by hand.',
  ],
]

/** The sentence a bare HTTP status gets when the body carried nothing readable. */
const BY_STATUS = new Map([
  [400, 'That was not accepted as sent. Check what you entered and try again.'],
  [401, SIGNED_OUT],
  [403, NOT_ALLOWED],
  [404, 'That is not there any more.'],
  [408, SLOW],
  [409, 'That has already been done.'],
  [413, 'That file is too large. Try one under the size the page asks for.'],
  [422, 'That was not accepted as sent. Check what you entered and try again.'],
  [429, TOO_FAST],
  [500, SERVER],
  [502, SERVER],
  [503, 'That service is down for a moment. Try again shortly.'],
  [504, SLOW],
])

/**
 * The marks of text written for a machine, any one of which disqualifies it.
 *
 * This is deliberately eager. A false positive costs a reader a general
 * sentence in place of a specific one; a false negative puts a stack frame or
 * a JSON body on a page somebody is being asked to trust with a card. Those
 * are not the same size of mistake, so the doubt goes one way.
 */
const MACHINE = [
  /[{}[\]]/, // JSON, anywhere in it
  /"\s*:/, // a JSON key, even without its braces
  /\n\s*at /, // a stack frame
  /\.(js|jsx|ts|tsx):\d+/, // a source position
  /\b[A-Za-z]*(?:Error|Exception)\b/, // TypeError, AuthApiError, DOMException
  /\b[a-z]+_[a-z_]+\b/, // invalid_grant, over_email_send_rate_limit
  // An identifier shouting in capitals. The shape has to be drawn narrowly,
  // because a short all-capitals word is far more often a trade than a code:
  // the outreach board answers 'Smith HVAC is already on file at the found
  // stage.', and a rule that read HVAC as an error code replaced that whole
  // sentence with a general one that named no business and no stage. So a run
  // of capitals only counts when it is long, carries a digit, or is joined by
  // an underscore — which ETIMEDOUT, PGRST116 and ERR_CONNECTION_REFUSED all
  // are, and which HVAC, ACME, LLC and CEO are not.
  /\b[A-Z][A-Z0-9]*_[A-Z0-9_]*\b/,
  /\b[A-Z]{2,}\d/,
  /\b[A-Z]{6,}\b/,
  /\b(?:status|code|errno)\b\s*[:=]/i,
  /\bhttp\/?[\d.]*\s*\d{3}\b/i,
  /\banswered \d{3}\b/i,
  /\b(?:undefined|null|NaN|\[object Object\])\b/,
  /\b(?:lighthouse|supabase|postgrest|psql|axios|fetch\(\)|api key|token)\b/i,
  // A browser explaining itself. These are whole sentences, correctly
  // punctuated, and about nothing the reader has heard of or can act on.
  /\b(?:cross-origin|canvas|CORS|MIME type|deployment|endpoint|payload)\b/i,
  /^\s*\d{3}\b/, // a status where a sentence should start
  /\(\s*\d{3}\s*\)/, // a status in brackets, as in 'could not be read (503).'
  /<\/?[a-z]/i, // markup
]

/**
 * Whether a string reads as something a person wrote for another person.
 *
 * The endpoints under `api/` and the validators in this app both write real
 * sentences, and those are better than anything chosen from a table here
 * because they know what was being attempted. So they are let through — but
 * only on proof, not on trust: it has to carry none of the marks above, and it
 * has to be the shape of a sentence rather than a fragment or an essay.
 */
export function readsAsWritten(text) {
  if (typeof text !== 'string') return false
  const said = text.trim()
  if (said.length < 12 || said.length > 200) return false
  if (MACHINE.some(mark => mark.test(said))) return false
  // A sentence starts like one and ends like one. Machine text that gets this
  // far is usually a fragment — a bare noun phrase, or a clause with no stop.
  // A digit is a fair way for a sentence to open when a business chose the
  // name — '1st Choice Roofing is already on file.' is somebody's actual
  // trading name, not a status code, and the bracketed-status rule above is
  // what catches the case this was standing in for.
  if (!/^[A-Z0-9"']/.test(said)) return false
  // The house voice does not use exclamation marks, so a string ending in one
  // was not written for this product. It is a narrow rule and it earns its
  // place: `Auth session missing!` is what supabase-js throws when a session
  // has gone, and it clears every other test here — twenty characters, a
  // capital, a terminal stop, no machine mark — so this is the only thing
  // standing between that and a reader.
  return /[.?]$/.test(said)
}

/** The text carried by whatever was thrown, wherever the thrower chose to put it. */
function textOf(cause) {
  if (!cause) return ''
  if (typeof cause === 'string') return cause
  if (typeof cause !== 'object') return ''
  const held = [cause.message, cause.error_description, cause.error, cause.detail, cause.hint]
  const said = held.find(value => typeof value === 'string' && value.trim())
  // A `name` on its own is the last thing worth reading, and it is only ever a
  // class name — but it is what distinguishes an abort from a network drop,
  // and both of those have sentences waiting for them above.
  return said || (typeof cause.name === 'string' ? cause.name : '')
}

/** The HTTP status carried by whatever was thrown, under any of its usual names. */
function statusOf(cause) {
  if (!cause || typeof cause !== 'object') return 0
  const held = [cause.status, cause.statusCode, cause.code]
  const found = held.find(value => Number.isInteger(value) && value >= 400 && value <= 599)
  return found || 0
}

/**
 * One sentence for a failure, fit to be read by the person it happened to.
 *
 * @param {unknown} cause - Anything at all: an Error, a Supabase error object,
 *   a parsed response body, a string, a status number, or nothing.
 * @param {string} [fallback] - What to say when the cause is unrecognisable.
 *   Pass one wherever the surrounding page knows what was being attempted —
 *   "the build could not be saved" beats the general sentence, because it says
 *   which of the four things on screen did not happen.
 * @returns {string} A sentence, always. Never empty, never machine text.
 */
export function faultMessage(cause, fallback = FALLBACK_FAULT) {
  if (Number.isInteger(cause)) return BY_STATUS.get(cause) || fallback

  const said = textOf(cause)
  const lowered = said.toLowerCase()
  const known = said && KNOWN.find(([mark]) => mark.test(lowered))
  if (known) return known[1]

  // A status is a better guide than an unrecognised sentence, because it is at
  // least true about what happened, and the sentence beside it usually is not
  // about the reader at all.
  const status = statusOf(cause)
  if (status && !readsAsWritten(said)) return BY_STATUS.get(status) || fallback

  return readsAsWritten(said) ? said : fallback
}

/**
 * One sentence for a fetch that came back refused.
 *
 * The pattern this replaces is written out at nearly every call site — read
 * the body, take `body.error` if it is there, fall back to a literal — and it
 * is where most of the raw text on this site got in, because `body.error` is
 * whatever the far end felt like and nothing was reading it.
 *
 * @param {Response} response - The refused response.
 * @param {unknown} [body] - Its parsed body, if the caller already read it.
 * @param {string} [fallback] - What to say when neither says anything readable.
 */
export function faultFromResponse(response, body, fallback = FALLBACK_FAULT) {
  const said = textOf(body)
  const lowered = said.toLowerCase()
  const known = said && KNOWN.find(([mark]) => mark.test(lowered))
  if (known) return known[1]
  if (readsAsWritten(said)) return said
  return BY_STATUS.get(response?.status) || fallback
}
