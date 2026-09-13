/**
 * Who is working the call list this minute, and who is on the phone with whom.
 *
 * The list is one queue and there is now more than one person on it. Nothing
 * in the ranking knows that: two callers who open the list inside a minute of
 * each other are handed the same first page in the same order, so they ring
 * the same business, and the business finds out before either of them does.
 * Suppression cannot fix it - a call is only suppressed once it has been
 * recorded, and the whole of the problem happens in the four minutes before
 * anybody records anything.
 *
 * So a caller says out loud that they are on a number, and every other console
 * sees it. One row per caller: they are either on the list or on the phone
 * with a particular business, and the row is the only place either fact is
 * held. The unique index over the business is what actually decides a race -
 * two consoles claiming the same number inside the same second are settled by
 * the database rather than by whichever answer landed second.
 *
 * A row is only as good as its last beat. A console that is closed, put to
 * sleep, or loses the network stops beating, and after `PRESENCE_TTL_MS`
 * everything it was holding is nobody's again - which is what stops a browser
 * crash locking a number until somebody notices. A held number has a ceiling
 * on top of that, because a beat is not proof of a call: a tab left open on a
 * claimed business would otherwise hold it all week.
 *
 * Strings and pure functions only. The console imports this into the browser
 * bundle beside `calls.js`, and the endpoint reads the same answers out of it,
 * so the two cannot disagree about who is holding what.
 */

/** How often a console says it is still here. */
export const BEAT_MS = 20_000

/**
 * How long one beat stands for.
 *
 * Three beats and a margin. Two would drop a caller off the board every time a
 * request took longer than the gap between beats, which on a phone tethered in
 * a truck is most of them, and a caller who blinks out of the board mid-call is
 * a number two other people are then free to ring.
 */
export const PRESENCE_TTL_MS = 70_000

/**
 * The longest a number stays held, however faithfully the console beats.
 *
 * A beat says the tab is open, which is not the same as somebody being on a
 * call. Ninety minutes is well past any call anybody on this list will ever
 * have and well under a working day, so a tab left open on a claimed business
 * gives it back the same afternoon rather than at the end of the week.
 */
export const PHONE_MAX_MS = 90 * 60_000

/** An instant as milliseconds, or null where there is none to read. */
function at(value) {
  if (!value) return null
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Whether a row's last beat is recent enough to still mean anything. */
export function presenceLive(row, now = new Date()) {
  const seen = at(row?.last_seen)
  return seen !== null && now.getTime() - seen < PRESENCE_TTL_MS
}

/**
 * Whether a row is holding a number right now.
 *
 * Both clocks have to agree: the console has beaten recently, and the call has
 * not been running longer than any call runs.
 */
export function onPhone(row, now = new Date()) {
  if (!row?.prospect_id || !presenceLive(row, now)) return false
  const since = at(row.on_phone_since)
  return since !== null && now.getTime() - since < PHONE_MAX_MS
}

/** Every row still beating, newest claim first. */
export function livePresence(rows, now = new Date()) {
  return (rows || [])
    .filter(row => presenceLive(row, now))
    .sort((one, two) => (at(two.on_phone_since) ?? 0) - (at(one.on_phone_since) ?? 0))
}

/** The callers actually on a phone, in the order they picked one up. */
export function onPhoneNow(rows, now = new Date()) {
  return livePresence(rows, now)
    .filter(row => onPhone(row, now))
    .sort((one, two) => (at(one.on_phone_since) ?? 0) - (at(two.on_phone_since) ?? 0))
}

/**
 * Which business each caller is holding, filed under the business.
 *
 * The list reads this per row, so it is a map rather than a scan: a hundred
 * rows against three callers is three hundred comparisons a render otherwise.
 */
export function heldNumbers(rows, now = new Date()) {
  const held = new Map()
  for (const row of onPhoneNow(rows, now)) held.set(row.prospect_id, row)
  return held
}

/**
 * Whoever is holding a number, unless that is the caller asking.
 *
 * A caller's own claim is not a warning to them - it is the call they are on -
 * so the row they hold reads as theirs rather than as somebody else's lock.
 */
export function heldByOther(held, prospectId, userId) {
  const row = held.get(prospectId)
  return row && row.user_id !== userId ? row : null
}

/**
 * The desk as it should now be held, reusing whatever has not actually changed.
 *
 * The beat lands three times a minute and almost always says exactly what the
 * last one said: the same person at the desk, nobody new on a call, the same
 * setup. Storing that answer as a fresh object anyway makes every value hanging
 * off it new as well, and everything drawn from any of them is drawn again three
 * times a minute to say that nothing had happened.
 *
 * So each part is compared against the part it would replace and the old one is
 * kept where the two say the same thing. The comparison is over the small board
 * this endpoint answers with - one row per person at the desk, and one setup -
 * which is cheaper by a wide margin than the render it saves.
 *
 * `at` is deliberately not compared. It is the clock the answer was taken on,
 * it differs every single time, and nothing on the page is drawn from it.
 */
export function settleDesk(current, payload) {
  // A beat answers with the board alone, because the setup only changes when
  // the person at this console changes it. An answer that carries no setup is
  // not an answer that the setup is gone.
  const carried = 'prefs' in payload ? payload.prefs : (current?.prefs ?? null)
  if (!current) return { ...payload, prefs: carried }
  const prefs = saysTheSame(current.prefs, carried) ? current.prefs : carried
  const presence = saysTheSame(current.presence, payload.presence)
    ? current.presence
    : payload.presence
  if (prefs === current.prefs && presence === current.presence && current.you === payload.you) {
    return current
  }
  return { ...payload, prefs, presence }
}

/** Whether two answers from the desk say the same thing. */
function saysTheSame(one, two) {
  return JSON.stringify(one) === JSON.stringify(two)
}

/** What a caller is called, from whatever the profile row carried. */
export function callerName(row) {
  const name = typeof row?.name === 'string' ? row.name.trim() : ''
  if (name) return name
  const email = typeof row?.email === 'string' ? row.email.trim() : ''
  if (email) return email.split('@')[0]
  return 'Somebody'
}

/**
 * How long a call has been running, the way somebody says it out loud.
 *
 * Seconds are not said at all. A figure that changes every second on a board
 * three people are glancing at is movement rather than information, and the
 * only thing anybody reads it for is whether a call has been going a while.
 */
export function saidSince(value, now = new Date()) {
  const since = at(value)
  if (since === null) return 'just now'
  const minutes = Math.floor((now.getTime() - since) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? '1 hr' : `${hours} hrs`
}
