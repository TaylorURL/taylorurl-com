import { Component } from 'react'

// Matches the various messages browsers and Vite use when a code-split chunk
// fails to load (transient network error, or a stale hashed filename requested
// against a newer deploy). These are recoverable by re-fetching the current
// asset manifest, which a single hard reload does.
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported/i

// The sessionStorage key and the window guarding the auto-reload. One reload
// recovers the crash a visitor would otherwise have to fix by hand, and the
// window is what stops a chunk that stays broken from trapping the tab in a
// reload loop: a second failure inside it shows the fallback instead.
const RELOAD_GUARD_KEY = 'taylorurl:chunk-reload-at'
const RELOAD_GUARD_MS = 20000

function isChunkLoadError(error) {
  return Boolean(error && CHUNK_ERROR_PATTERN.test(error.name + ' ' + error.message))
}

function recentlyReloaded() {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY))
    return Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS
  } catch {
    return false
  }
}

function markReloaded() {
  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    // Private-mode or storage-disabled: fall through; worst case is the
    // fallback UI instead of an auto-reload, which is still recoverable.
  }
}

/**
 * App-wide error boundary around the lazy-loaded route tree. Without it, a
 * single rejected `import()` for a route (or a throw inside a view) propagates
 * past Suspense and unmounts the entire app to a blank page that only a manual
 * reload fixes — the "first-load crash" this guards against.
 *
 * A chunk-load error reloads the page once automatically, and nothing is drawn
 * while that reload is on its way. Painting the fallback first is what put a
 * "this page didn't load correctly" screen in front of every navigation that
 * outlived a deploy, a frame before the reload replaced it. The recovery works
 * either way; only one of them is visible.
 *
 * Any other error renders a minimal on-brand fallback with a manual reload
 * rather than a blank screen.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false, reloading: false }

  static getDerivedStateFromError(error) {
    // A chunk error that has not just been retried is about to reload, so the
    // boundary holds an empty frame rather than an error a reader can act on.
    if (isChunkLoadError(error) && !recentlyReloaded()) {
      return { failed: true, reloading: true }
    }
    return { failed: true, reloading: false }
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && !recentlyReloaded()) {
      markReloaded()
      window.location.reload()
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    // The reload is already scheduled. An error screen for the frames before it
    // lands reads as a fault rather than as the recovery it is.
    if (this.state.reloading) return null

    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-ink"
      >
        <p className="section-label text-accent">Something Went Wrong</p>
        <h1 className="display-5 max-w-md font-semibold leading-[1.1] tracking-tightest [text-wrap:balance]">
          This page didn’t load correctly.
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload the Page
          </button>
          {/* A boundary that has caught holds its state for the life of the
              document, so a router link lands the reader back on this same
              screen. The second way out has to fetch a fresh one. */}
          <a className="btn btn-secondary" href="/">
            Return to Home
          </a>
        </div>
      </div>
    )
  }
}
