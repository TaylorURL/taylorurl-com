import { Component } from 'react'

// Matches the various messages browsers and Vite use when a code-split chunk
// fails to load (transient network error, or a stale hashed filename requested
// against a newer deploy). These are recoverable by re-fetching the current
// asset manifest, which a single hard reload does.
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported/i

// sessionStorage key + window guarding the auto-reload. We reload once to
// recover the crash the visitor would otherwise have to fix by hand, but never
// faster than this window — so a genuinely broken chunk (bad deploy) shows the
// fallback instead of trapping the tab in a reload loop.
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
 * For chunk-load errors it reloads the page once automatically (see the guard
 * above), turning the crash into a brief, self-healing blip. Any other error
 * renders a minimal on-brand fallback with a manual reload rather than a blank
 * screen.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error) && !recentlyReloaded()) {
      markReloaded()
      window.location.reload()
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-ink">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
          // Something went wrong
        </p>
        <h1 className="max-w-md text-[clamp(1.5rem,4vw,2.25rem)] font-semibold leading-tight tracking-tight">
          This page didn't load correctly.
        </h1>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="border-hair rounded-full border px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-bg"
        >
          Reload the page
        </button>
      </div>
    )
  }
}
