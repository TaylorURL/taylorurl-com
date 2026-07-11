import { useEffect, useState } from 'react'

/**
 * Renders children only after mount. The site prerenders every route with
 * `renderToStaticMarkup`, so WebGL-backed react-bits backgrounds (Aurora,
 * Particles, Threads) — which build an OGL renderer in an effect — have
 * nothing to draw on the server. Gating them here keeps the static HTML clean
 * and avoids any hydration mismatch, while a `min-h`/`aria-hidden` placeholder
 * holds the layout until the canvas paints on the client.
 */
export default function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : fallback
}
