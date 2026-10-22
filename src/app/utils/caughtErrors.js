/**
 * Who reports a failure a boundary caught.
 *
 * Nothing on this site ever decided that. React did, as a side effect of how it
 * announces a caught error: its default handler writes the error to
 * `console.error`, the reporter in the page head wraps that method, and so
 * every error any boundary catches reaches the collector at the instant it is
 * caught. For a boundary that is the end of the story, which is most of them,
 * that is exactly right and this changes nothing about it.
 *
 * It is wrong for a boundary with a recovery above it, and the cost is a ticket
 * that says the opposite of what happened. `LateChrome` catches its piece
 * failing, offers it again five seconds later, and the piece arrives: the
 * reader has an assistant in the corner and the queue has a fault saying the
 * file behind it could not be fetched. Measured against the built site with
 * that chunk refused for twelve seconds and served from then on -- the length
 * of the outage the report was filed against -- the launcher was on screen at
 * 12.2 seconds and one fault had already gone to the collector at 6.8. That is
 * #564, and it is why #542 did not hold: #542 was the recovery, it works, and
 * nothing was ever told to stop reporting.
 *
 * So the announcement is taken back off React and handed to the boundaries. An
 * error nobody claims is written out exactly as React wrote it and files
 * exactly the ticket it always did. An error a recovery claims is that
 * recovery's to report, once its attempts are spent -- the same rule the
 * assistant's own probe is held to in `data/liveChat.js`, where the sentence is
 * only true of a page whose last ask went unanswered.
 *
 * The claim is made in `componentDidCatch`, which React runs immediately after
 * this handler and inside the same commit, so the decision here waits one
 * microtask rather than reading a flag that cannot be set yet.
 */

// Held weakly, because what is being remembered about an error is only of
// interest while something is still holding the error itself.
const claimed = new WeakSet()

/**
 * This failure belongs to a recovery, which will report it if it gives up.
 *
 * @param {unknown} error - What the boundary caught.
 */
export function claimCaught(error) {
  if (error !== null && typeof error === 'object') claimed.add(error)
}

// Which failures have been announced already, so that one fault is one
// report. Weak for the same reason as the set above.
const announced = new WeakSet()

/**
 * Writes a failure out once, where nothing else has claimed or announced it.
 *
 * @param {unknown} error - What is being reported.
 * @param {{ componentStack?: string }} [info] - Where it was caught.
 */
function announce(error, info) {
  if (error !== null && typeof error === 'object') {
    if (claimed.has(error)) return
    if (announced.has(error)) return
    announced.add(error)
  }
  // One argument, because that is what React passed and because the error
  // carries its own stack - which is the thing the collector reads to name the
  // file that failed. The component stack is worth having in front of whoever
  // is running the site locally and is not worth changing a ticket's identity
  // over.
  if (import.meta.env.DEV && info && info.componentStack) {
    console.error(error, info.componentStack)
    return
  }
  console.error(error)
}

/**
 * React's announcement of an error an error boundary caught.
 *
 * @param {unknown} error - What was caught.
 * @param {{ componentStack?: string }} [info] - Where it was caught.
 */
export function onCaughtError(error, info) {
  queueMicrotask(() => announce(error, info))
}

/**
 * React's announcement that it recovered from an error by itself.
 *
 * Left to React this is the one failure on the site that is reported twice. A
 * concurrent render that throws is retried by rendering the whole root
 * synchronously, and when that pass succeeds React reports
 * `Error('There was an error during concurrent rendering but React was able to
 * recover...', { cause: thrown })` - which the default handler hands to
 * `reportError`, so it reaches the page as an uncaught error. The failure
 * itself reaches a boundary in the synchronous pass and is announced by
 * `onCaughtError` above. One chunk that would not parse therefore filed #920
 * and #921 in the same second: the recovery notice, carrying a scheduler frame
 * and no page, component or file in it, and the fault, carrying the
 * announcement's own frame.
 *
 * So the recovery reports the fault it recovered from rather than itself, and
 * the set above makes that one report however the two microtasks fall. A
 * recoverable error React raised about nothing in particular - a hydration
 * mismatch, which carries no cause - is still written out exactly as it was.
 *
 * @param {unknown} error - What React recovered from.
 */
export function onRecoverableError(error) {
  queueMicrotask(() => {
    const cause = error !== null && typeof error === 'object' ? error.cause : null
    announce(cause !== null && cause !== undefined ? cause : error)
  })
}
