/**
 * preview-events - what a prospect did on their preview site, in batches.
 *
 * The preview page (TaylorURL/previews, src/track.js) posts here with
 * sendBeacon once a visit has passed the same gate the view count waits on: a
 * preview rather than a sample, not the studio's own browser, not an automated
 * one, and actually looked at. The body is sent as text/plain so the browser
 * never asks first, and nothing the page could act on comes back.
 *
 * Everything else is decided in the database by `preview_track()`, which asks
 * `preview_view_ours()` - the same function `preview_site()` asks before it
 * counts a view - whether the caller is on one of the studio's own connections,
 * and drops the batch when it is, or when the preview's letter has not gone.
 * The caller's address is read for that question and for the rate limit, and
 * is never written anywhere.
 *
 * The answer is always 204, whatever happened to the batch. A tracker has no
 * use for the reason, and a scanner trying shapes learns nothing from it.
 */

import { connect } from '../lib/db/clients.js'
import { UUID_PATTERN } from '../lib/db/fields.js'
import { readBody } from '../lib/http/body.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'

/** The most a batch can be, in characters, and in events. */
const MAX_BODY = 48 * 1024
const MAX_EVENTS = 200

/** Every kind of event the tracker sends. Anything else is dropped. */
export const EVENT_TYPES = new Set([
  'page',
  'scroll',
  'section',
  'click',
  'hover',
  'rage',
  'dead',
  'focus',
  'blur',
  'submit',
  'idle',
  'hidden',
  'end',
])

const SLUG = /^[a-z0-9-]{2,63}$/
const TEMPLATE = /^[a-z]{2,24}$/

// A reader sends a batch every ten seconds at most, and more on a hidden tab
// or a page change. Thirty a minute is a busy reader on a fast click-through.
const batches = callerWindow({ limit: 30, windowMs: 60 * 1000 })

const text = (value, n) => (typeof value === 'string' ? value.slice(0, n) : undefined)
const number = value => (Number.isFinite(value) ? Math.round(value) : undefined)

/**
 * The batch as the database will take it, or null when it is not one.
 *
 * Every field is picked by name and cut to length, so anything the page did
 * not mean to send - or a caller who is not the page - goes no further.
 */
export function cleanBatch(body) {
  if (!body || typeof body !== 'object') return null
  const { slug, template, sid, vid, path = '', ctx = {}, ev } = body
  if (!SLUG.test(slug ?? '') || !TEMPLATE.test(template ?? '')) return null
  if (!UUID_PATTERN.test(sid ?? '') || !UUID_PATTERN.test(vid ?? '')) return null
  if (!Array.isArray(ev) || !ev.length) return null
  const events = ev
    .slice(0, MAX_EVENTS)
    .filter(event => event && EVENT_TYPES.has(event.t))
    .map(event => ({
      t: event.t,
      at: number(event.at),
      path: text(event.path, 120),
      name: text(event.name, 80),
      target: text(event.target, 200),
      kind: text(event.kind, 16),
      value: number(event.value),
    }))
  if (!events.length) return null
  const utm =
    ctx.utm && typeof ctx.utm === 'object' && !Array.isArray(ctx.utm)
      ? Object.fromEntries(
          Object.entries(ctx.utm)
            .filter(([key, value]) => /^utm_[a-z_]{1,16}$/.test(key) && typeof value === 'string')
            .slice(0, 6)
            .map(([key, value]) => [key, value.slice(0, 60)])
        )
      : null
  return {
    slug,
    template,
    sid: sid.toLowerCase(),
    vid: vid.toLowerCase(),
    path: text(path, 120) ?? '',
    ctx: {
      device: text(ctx.device, 16),
      os: text(ctx.os, 24),
      browser: text(ctx.browser, 24),
      viewport: text(ctx.viewport, 16),
      referrer: text(ctx.referrer, 200),
      source: text(ctx.source, 64),
      utm: utm && Object.keys(utm).length ? utm : null,
    },
    ev: events,
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).end()
    return
  }
  response.setHeader('Cache-Control', 'no-store')

  const address = callerAddress(request)
  if (!batches.allows(address)) {
    response.status(429).end()
    return
  }

  const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? '')
  if (raw.length > MAX_BODY) {
    response.status(413).end()
    return
  }
  const batch = cleanBatch(readBody(request))
  if (!batch) {
    response.status(204).end()
    return
  }

  const connected = connect()
  if (!connected) {
    response.status(204).end()
    return
  }
  const { error } = await connected.db.rpc('preview_track', {
    p_forwarded: address,
    p_batch: batch,
  })
  if (error) console.error('preview events: %s', error.message)
  response.status(204).end()
}
