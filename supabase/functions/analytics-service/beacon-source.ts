// ESLint-disable-next-line
// Beacon SDK source, inlined as a string so the Supabase bundler ships it with
// the function. The two placeholders `__BASE_URL__` and `__API_KEY__` are
// substituted by index.ts at serve time.
//
// Maintenance rule: keep this identical to the JS you'd hand to a browser.
// If you need types/validation, extract a separate .ts that compiles down —
// do NOT split this into multiple statements or refactor it past what you'd
// run in an HTML <script> tag.

export const BEACON_SOURCE = String.raw`
/* eslint-disable */
/**
 * TaylorURL analytics beacon.
 *
 * Served by the analytics-service edge function at /beacon.js and loaded via:
 *   <script src="https://<project>.supabase.co/functions/v1/analytics-service/beacon.js"
 *           data-project="yourdomain.com" defer></script>
 *
 * Responsibilities:
 *   - Tracks page views on load (manual re-track via window.__taylorURL.track()).
 *   - Sends a heartbeat every 30s while the page is open.
 *
 * The two __BASE_URL__ / __API_KEY__ placeholders are filled in by the edge
 * function before the script is served.
 */
(function () {
  'use strict'

  var BASE_URL = '__BASE_URL__'
  var API_KEY = '__API_KEY__'
  var HEARTBEAT_MS = 30000

  var script = document.currentScript
  var project = script && script.getAttribute('data-project')
  if (!project) return

  function post(path, body) {
    return fetch(BASE_URL + '/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: API_KEY,
        Authorization: 'Bearer ' + API_KEY,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(function () {})
  }

  function track() {
    post('analytics-service/track', {
      project: project,
      page_url: location.pathname + location.search,
      referrer: document.referrer || null,
    })
  }

  function heartbeat() {
    post('analytics-service/heartbeat', { project: project })
  }

  window.__taylorURL = {
    /** Manually re-send a page-view event (e.g. on SPA route change). */
    track: track,
    /** Manually send a heartbeat (rarely needed — the beacon does this every 30s). */
    heartbeat: heartbeat,
    /** Beacon version. Bump when the contract changes. */
    version: '3.0.0',
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', track)
  } else {
    track()
  }
  setInterval(heartbeat, HEARTBEAT_MS)
})()
`
