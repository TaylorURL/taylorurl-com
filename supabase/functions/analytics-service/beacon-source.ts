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
 * TaylorURL unified client SDK.
 *
 * Served by the analytics-service edge function at /beacon.js and loaded via:
 *   <script src="https://<project>.supabase.co/functions/v1/analytics-service/beacon.js"
 *           data-project="yourdomain.com" defer></script>
 *
 * Responsibilities:
 *   - Analytics: tracks page views on load, sends heartbeat every 30s.
 *   - Error capture: window.onerror, unhandledrejection, fetch/XHR 4xx-5xx,
 *     batched + deduped + delivered with keepalive.
 *   - Exposes window.__taylorURL for manual reporting (React ErrorBoundary etc.).
 *
 * The two __BASE_URL__ / __API_KEY__ placeholders are filled in by the edge
 * function before the script is served.
 */
(function () {
  'use strict'

  var BASE_URL = '__BASE_URL__'
  var API_KEY = '__API_KEY__'
  var HEARTBEAT_MS = 30000
  var ERROR_BATCH_SIZE = 10
  var ERROR_FLUSH_MS = 30000
  var DEDUP_WINDOW_MS = 60000
  var HTTP_ERROR_THRESHOLD = 400
  var MAX_QUEUE = 100

  var script = document.currentScript
  var project = script && script.getAttribute('data-project')
  if (!project) return

  var UA = navigator.userAgent || ''

  function match(patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = UA.match(patterns[i][0])
      if (m) return { name: patterns[i][1], version: m[1] || null }
    }
    return { name: 'Unknown', version: null }
  }

  var browserInfo = match([
    [/Edg\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ])
  var osInfo = match([
    [/Windows NT 10/, 'Windows 10/11'],
    [/Mac OS X (\d+[._]\d+)/, 'macOS'],
    [/Android (\d+)/, 'Android'],
    [/iPhone OS (\d+)/, 'iOS'],
    [/Linux/, 'Linux'],
  ])
  var browser = browserInfo.version ? browserInfo.name + ' ' + browserInfo.version : browserInfo.name
  var os = osInfo.version ? osInfo.name + ' ' + osInfo.version.replace(/_/g, '.') : osInfo.name

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

  // ───────────────────────── Analytics ─────────────────────────

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

  // ─────────────────────── Error reporting ──────────────────────

  var errorQueue = []
  var dedupMap = {}
  var flushing = false

  function buildPayload(opts) {
    return {
      project: project,
      error_message: String(opts.message || 'Unknown error'),
      source_file: opts.source || null,
      line_number: typeof opts.line === 'number' ? opts.line : null,
      column_number: typeof opts.column === 'number' ? opts.column : null,
      component_stack: opts.componentStack || null,
      stack_trace: opts.stack || null,
      url: location.href,
      user_agent: UA,
      browser: browser,
      os: os,
    }
  }

  function enqueue(payload) {
    var key =
      payload.project + '|' + payload.error_message + '|' +
      (payload.source_file || '') + '|' + (payload.line_number || '')
    var now = Date.now()
    var seenAt = dedupMap[key]
    if (seenAt && now - seenAt < DEDUP_WINDOW_MS) return
    dedupMap[key] = now
    if (errorQueue.length >= MAX_QUEUE) errorQueue.shift()
    errorQueue.push(payload)
    if (errorQueue.length >= ERROR_BATCH_SIZE) flushErrors()
  }

  function flushErrors() {
    if (flushing || errorQueue.length === 0) return
    flushing = true
    var batch = errorQueue.splice(0, ERROR_BATCH_SIZE)
    post('error-reporting-service/report-batch', { errors: batch })
      .then(function () { flushing = false })
      .catch(function () { flushing = false })
  }

  function isOwnEndpoint(url) {
    return typeof url === 'string' && (
      url.indexOf('error-reporting-service') >= 0 ||
      url.indexOf('analytics-service') >= 0
    )
  }

  // Native error events
  window.addEventListener('error', function (event) {
    if (typeof event.message === 'string' && isOwnEndpoint(event.message)) return
    enqueue(buildPayload({
      message: (event.error && event.error.message) || event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error && event.error.stack,
    }))
  })

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason
    var message = reason instanceof Error
      ? reason.message
      : String(reason == null ? 'Unhandled promise rejection' : reason)
    if (isOwnEndpoint(message)) return
    enqueue(buildPayload({
      message: message,
      stack: reason instanceof Error ? reason.stack : null,
    }))
  })

  // Wrap fetch to capture 4xx/5xx responses
  var originalFetch = window.fetch
  window.fetch = function () {
    var args = arguments
    var input = args[0]
    var url = typeof input === 'string' ? input : (input && input.url) || ''
    if (isOwnEndpoint(url)) return originalFetch.apply(this, args)
    return originalFetch.apply(this, args).then(function (response) {
      if (response.status >= HTTP_ERROR_THRESHOLD) {
        enqueue(buildPayload({
          message: 'HTTP ' + response.status + ' ' + response.statusText + ' — ' + url,
          source: url,
        }))
      }
      return response
    })
  }

  // Wrap XHR to capture 4xx/5xx responses
  var origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__taylorURL_url = typeof url === 'string' ? url : String(url)
    return origOpen.apply(this, arguments)
  }
  var origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function () {
    var self = this
    this.addEventListener('loadend', function () {
      if (isOwnEndpoint(self.__taylorURL_url)) return
      if (self.status >= HTTP_ERROR_THRESHOLD) {
        enqueue(buildPayload({
          message: 'HTTP ' + self.status + ' ' + self.statusText + ' — ' + self.__taylorURL_url,
          source: self.__taylorURL_url,
        }))
      }
    })
    return origSend.apply(this, arguments)
  }

  // Best-effort flush when the user navigates away
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushErrors()
  })
  setInterval(flushErrors, ERROR_FLUSH_MS)

  // ─────────────────────── Global API ───────────────────────

  window.__taylorURL = {
    /** Report an Error object (or any value). Optional metadata: { context, component_stack }. */
    reportError: function (error, metadata) {
      var msg = (error && error.message) ? error.message : String(error)
      var payload = buildPayload({
        message: msg,
        stack: error && error.stack,
        componentStack: metadata && metadata.component_stack,
      })
      if (metadata && metadata.context) {
        payload.component_stack = 'Context: ' + metadata.context + '\n' + (payload.component_stack || '')
      }
      enqueue(payload)
    },
    /** Force flush queued errors immediately. */
    flush: flushErrors,
    /** Manually re-send a page-view event (e.g. on SPA route change). */
    track: track,
    /** Manually send a heartbeat (rarely needed — the beacon does this every 30s). */
    heartbeat: heartbeat,
    /** Beacon version. Bump when the contract changes. */
    version: '2.0.0',
  }

  // ─────────────────────── Analytics kickoff ───────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', track)
  } else {
    track()
  }
  setInterval(heartbeat, HEARTBEAT_MS)
})()
`
