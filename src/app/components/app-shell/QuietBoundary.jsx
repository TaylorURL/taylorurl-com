import { Component } from 'react'

/**
 * A boundary for the pieces that decorate a page rather than being one.
 *
 * `ErrorBoundary` sits above the whole routed tree and answers for the page
 * itself, so what it does when a chunk will not arrive is right for a route and
 * wrong for everything else: it reloads the document. A route is the page, and a
 * page that cannot be built is worth fetching again. The assistant in the corner
 * and the section marks down the side are not, and putting them on that path
 * made the two smallest things on screen the two things able to throw the
 * reader's page away -- mid-form, mid-scroll, mid-thread -- over a file that
 * decorates it.
 *
 * The second failure is worse and quieter. That reload is allowed once inside a
 * twenty-second window, and a deploy replaces every hashed chunk at once, so the
 * window is usually already spent by the time a corner piece asks for its own.
 * The boundary above then has nothing left to try and draws the screen it keeps
 * for a page that will not load: a full-height panel saying this page didn't
 * load correctly, in front of a page that had loaded correctly and was being
 * read.
 *
 * So a piece of chrome fails here instead, and failing means leaving. Nothing is
 * drawn, nothing is reloaded, and the page it was decorating carries on without
 * it -- which is what the page looked like a frame earlier anyway, since all of
 * these arrive late by design.
 *
 * How long it stays gone is not decided here. This boundary holds `failed` for
 * as long as it is mounted, which is the whole visit for anything the layout
 * carries; `LateChrome` is what offers the piece again, and what a piece not
 * wrapped in one gets is a single chance.
 *
 * Silent to the reader is not silent to us. The import's rejection has already
 * gone to the collector by the time this catches it: the reporter in the page
 * head wraps `fetch`, and a chunk that 404s is filed as the fault it is. This
 * only decides who pays for it, and the answer is nobody.
 */
export default class QuietBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  // A piece that a press opened leaves the bar behind it holding it open, and
  // the bar is the only thing that can put that back. `LateChrome` listens for
  // a second reason: this stays failed for as long as it is mounted, so
  // something outside it has to hear that a piece has gone if the piece is ever
  // to be offered again. The failure itself goes with the news, because the
  // address to ask at next is inside it.
  componentDidCatch(error) {
    if (this.props.onFail) this.props.onFail(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
