/**
 * Pacing the wait on a reading nothing reports progress for.
 *
 * A presence check runs two page loads on Google's hardware and takes most of a
 * minute, and neither load says how far along it is. So the wait is estimated,
 * and the estimate is kept honest by what it is allowed to claim: the elapsed
 * count is measured and exact, the bar approaches the end without arriving, and
 * the stages are named in the order they actually finish.
 *
 * It lives apart from the view because it is the part with arithmetic in it,
 * and arithmetic that decides whether a reader believes the page is alive is
 * worth a test that does not need a browser.
 */

// The stages, in the order they finish, with the point in a typical run each is
// done by. From timing real runs: the reads of the site itself answer in a few
// seconds while the phone reading is still going, and the desktop reading
// follows it.
export const STAGES = [
  { label: 'Reading what a crawler reads', doneBy: 6000 },
  { label: 'Checking the address answers one way', doneBy: 10_000 },
  { label: 'Loading your site the way a phone would', doneBy: 26_000 },
  { label: 'Loading it again the way a desktop would', doneBy: Infinity },
]

/** What a run takes when nothing is slow. It sets the pace of the bar alone. */
export const TYPICAL_MS = 45_000

/**
 * How often the wait is redrawn. The elapsed count is the part a reader can
 * check against their own sense of how long they have sat there, so it is
 * redrawn often enough to look like a clock rather than a poll.
 */
export const TICK_MS = 250

/**
 * How full to draw the bar, from how long the run has been going.
 *
 * The curve approaches one without reaching it, so a run that takes longer than
 * most still shows something moving and the bar never claims to have finished
 * before the report exists.
 *
 * @param {number} elapsed - Milliseconds since the run started.
 * @returns {number} A share between 0 and 1, exclusive of 1.
 */
export function creep(elapsed) {
  return 1 - Math.exp(-Math.max(0, elapsed) / (TYPICAL_MS / 1.6))
}

/**
 * Which stage is in hand.
 *
 * Keyed on elapsed time rather than on how full the bar is: the bar eases and
 * time does not, so reading the stages off the curve skipped the short ones.
 *
 * @param {number} elapsed - Milliseconds since the run started.
 * @returns {number} Index into `STAGES`.
 */
export function stageAt(elapsed) {
  const reached = STAGES.findIndex(stage => elapsed < stage.doneBy)
  return reached === -1 ? STAGES.length - 1 : reached
}

/** The elapsed time as a reader reads a clock. */
export function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
