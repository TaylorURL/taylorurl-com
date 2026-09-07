import { useEffect, useState } from 'react'
import { capturedIcon, iconGround } from '@data/console/siteIcons'

/**
 * A site's own mark, drawn so a column of them reads as one set.
 *
 * The work happens before the browser sees these. A favicon taken straight from
 * its host is whatever that host serves - a 16px ICO, a 512px PNG, artwork on
 * nothing, or that same artwork baked onto a white square - and a column of
 * those is a fight. Each is normalised in the repository instead: lifted off
 * its ground, trimmed to its own bounds, centred, and written at one size. That
 * is what settles the fight, and it settles it without touching the colours.
 *
 * Which they keep. At twenty pixels colour is what identifies a brand, and
 * draining it turns a badge into a grey shield and a wordmark into a smear - a
 * column of grey blobs is harder to read down than the same column of logos.
 *
 * The tile behind them is the quiet part: one size, one radius, one hairline,
 * and the mark inset so nothing touches an edge. Its ground is the one thing
 * decided per icon rather than once for all of them, because artwork in pale
 * ink is invisible on pale paper however good the rest of the treatment is.
 *
 * A host with no captured mark still gets one: the site's own favicon at the
 * three conventional paths, then its own letter, which occupies the same box so
 * the column of names beside it stays straight.
 *
 * Those three paths are guesses, and a site answering at one of them 404s at
 * the other two by definition. That is the fallback working rather than a
 * broken image, so each guess is marked `data-probe` and the page's error
 * collector holds it instead of filing it as a defect on the site.
 */

const CANDIDATES = ['/favicon.ico', '/favicon.png', '/favicon.svg']

const MEMORY = 'taylorurl_console_site_icons'

function remembered() {
  try {
    return JSON.parse(window.sessionStorage.getItem(MEMORY) || '{}')
  } catch {
    // Private browsing refuses the read; every icon simply races again.
    return {}
  }
}

function remember(host, url) {
  try {
    const held = remembered()
    held[host] = url
    window.sessionStorage.setItem(MEMORY, JSON.stringify(held))
  } catch {
    // Nothing to do; the answer is found again next time the menu opens.
  }
}

/** The letter drawn when a site serves no icon anywhere. */
function initialOf(name) {
  return String(name ?? '?')
    .trim()
    .replace(/^www\./, '')
    .charAt(0)
    .toUpperCase()
}

/** Where a live favicon attempt stands: a URL, null for none, undefined for untried. */
function held(host) {
  return remembered()[host]
}

export function SiteIcon({ host, name, className = '' }) {
  const captured = capturedIcon(host)
  const [attempt, setAttempt] = useState(() => (held(host) === undefined ? 0 : CANDIDATES.length))
  const [found, setFound] = useState(() => held(host) ?? null)

  useEffect(() => {
    const known = held(host)
    setFound(known ?? null)
    setAttempt(known === undefined ? 0 : CANDIDATES.length)
  }, [host])

  const live =
    found ?? (attempt < CANDIDATES.length ? `https://${host}${CANDIDATES[attempt]}` : null)
  const src = captured || live
  // A guess, rather than an address the site gave us. Most hosts answer at one
  // of the three and 404 at the other two, which is the fallback working and
  // not a broken image, so these carry `data-probe` and the page's error
  // collector holds them instead of filing them. Once one of them answers, the
  // URL is remembered and the mark stops being a probe.
  const probing = !captured && !found && Boolean(live)

  if (!host || !src) {
    return (
      <span
        className={`console-site-icon console-site-icon-letter ${className}`}
        aria-hidden="true"
      >
        {initialOf(name || host)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width="16"
      height="16"
      loading="lazy"
      decoding="async"
      data-ground={iconGround(host)}
      data-probe={probing ? '' : undefined}
      className={`console-site-icon ${className}`}
      onLoad={() => {
        if (!captured) remember(host, src)
      }}
      onError={() => {
        if (captured) return
        const next = attempt + 1
        setAttempt(next)
        if (next >= CANDIDATES.length) remember(host, null)
      }}
    />
  )
}
