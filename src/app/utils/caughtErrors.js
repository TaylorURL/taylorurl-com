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

/**
 * React's announcement of an error an error boundary caught.
 *
 * @param {unknown} error - What was caught.
 * @param {{ componentStack?: string }} [info] - Where it was caught.
 */
export function onCaughtError(error, info) {
  queueMicrotask(() => {
    if (error !== null && typeof error === 'object' && claimed.has(error)) return
    // One argument, because that is what React passed and what the collector
    // has been fingerprinting these by. The component stack is worth having in
    // front of whoever is running the site locally and is not worth changing a
    // ticket's identity over.
    if (import.meta.env.DEV && info && info.componentStack) {
      console.error(error, info.componentStack)
      return
    }
    console.error(error)
  })
}
