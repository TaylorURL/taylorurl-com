/**
 * Holds the preview texts to what the line promises: a number read one way
 * whatever the listing wrote, no text outside 9:00 to 17:00 Central or on a
 * Sunday, nothing before the switches and the start say so, the three texts
 * each naming the business and its draft, a webhook that refuses any request
 * Twilio did not sign, and a first text that is asked of the text line rather
 * than the mailbox and sets aside a business whose number is closed.
 *
 *   node scripts/outreach/previews/check-preview-texts.js
 */
import { createHmac } from 'node:crypto'
import { check, finish, ok, same } from '../../harness/checks.js'
import { asked, stubDb } from '../database-fixture.js'

process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000'
process.env.TWILIO_AUTH_TOKEN = 'check-token'
process.env.OUTREACH_SEND_ARMED = 'true'

const { inTextHours, signedByTwilio, textLineOf, usPhone, TEXT_HOOK } =
  await import('../../../lib/outreach/sending/texts.js')
const { PREVIEW_TEXT_DAYS, previewText } = await import('../../../lib/outreach/preview-texts.js')
const { previewUrl } = await import('../../../lib/outreach/previews.js')
const { default: handler } = await import('../../../api/outreach/texts.js')
const { work: previewsWork } = await import('../../../api/outreach/previews.js')

check('a listed number reads as one string however it was written', () => {
  same(usPhone('(281) 555-0142'), '+12815550142', 'parenthesised')
  same(usPhone('281.555.0142'), '+12815550142', 'dotted')
  same(usPhone('+1 281-555-0142'), '+12815550142', 'with the country code')
  same(usPhone('1-281-555-0142'), '+12815550142', 'with a leading one')
  same(usPhone('555-0142'), null, 'seven digits')
  same(usPhone('081-555-0142'), null, 'an area code that cannot exist')
  same(usPhone(null), null, 'nothing')
})

// 2026-10-14 is a Wednesday; Central is five hours behind UTC that week.
check('a text leaves between 9:00 and 17:00 Central and not on a Sunday', () => {
  ok(!inTextHours(new Date('2026-10-14T13:59:00Z')), '8:59 on a Wednesday is open')
  ok(inTextHours(new Date('2026-10-14T14:00:00Z')), '9:00 on a Wednesday is closed')
  ok(inTextHours(new Date('2026-10-14T21:59:00Z')), '16:59 on a Wednesday is closed')
  ok(!inTextHours(new Date('2026-10-14T22:00:00Z')), '17:00 on a Wednesday is open')
  ok(inTextHours(new Date('2026-10-17T15:00:00Z')), '10:00 on a Saturday is closed')
  ok(!inTextHours(new Date('2026-10-18T17:00:00Z')), 'noon on a Sunday is open')
  // After the clocks go back, nine in the morning is fifteen hundred UTC.
  ok(!inTextHours(new Date('2026-11-04T14:30:00Z')), '8:30 in November is open')
  ok(inTextHours(new Date('2026-11-04T15:00:00Z')), '9:00 in November is closed')
})

const OPEN_AT = new Date('2026-10-14T16:00:00Z')
const ready = {
  sending_enabled: true,
  texting_enabled: true,
  texting_starts_at: '2026-10-14T14:00:00Z',
  text_service_sid: 'MG00000000000000000000000000000000',
}

check('the line opens only with every switch on and the start passed', () => {
  ok(textLineOf(ready, OPEN_AT).open, 'a ready line is closed')
  same(textLineOf(ready, OPEN_AT).service, ready.text_service_sid, 'service')
  ok(!textLineOf({ ...ready, text_service_sid: null }, OPEN_AT).open, 'open with no number')
  ok(!textLineOf({ ...ready, sending_enabled: false }, OPEN_AT).open, 'open with sending off')
  ok(!textLineOf({ ...ready, texting_enabled: false }, OPEN_AT).open, 'open with texting off')
  ok(!textLineOf({ ...ready, texting_starts_at: null }, OPEN_AT).open, 'open with no start')
  ok(
    !textLineOf({ ...ready, texting_starts_at: '2026-10-15T14:00:00Z' }, OPEN_AT).open,
    'open before the start'
  )
  ok(!textLineOf(ready, new Date('2026-10-14T23:00:00Z')).open, 'open after hours')
})

const site = {
  slug: 'baytownplumbing',
  name: 'Baytown Plumbing Co',
  shot_url: 'https://example.test/baytownplumbing.jpg',
  expires_at: '2026-11-06T15:00:00Z',
}
const URL = previewUrl(site.slug)

check('the first text names the business, gives the draft and carries its picture', () => {
  const first = previewText(site, 0)
  ok(first.body.includes(site.name), 'no business name')
  ok(first.body.includes(URL), 'no address')
  ok(first.body.includes('Reply STOP to opt out.'), 'no way to stop')
  same(first.mediaUrl, site.shot_url, 'picture')
  ok(first.body.length <= 320, `it runs ${first.body.length} characters`)
})
check('the follow-ups are short, carry no picture and the last says when it comes down', () => {
  const nudge = previewText(site, 1)
  const last = previewText(site, 2)
  ok(nudge.body.includes(URL), 'the nudge has no address')
  same(nudge.mediaUrl, null, 'nudge picture')
  same(last.mediaUrl, null, 'last picture')
  // 2026-11-06 at 15:00 UTC is a Friday morning in Central.
  ok(last.body.includes("I'm taking it down Friday."), `the last says: ${last.body}`)
  ok(nudge.body.length <= 160 && last.body.length <= 160, 'a follow-up runs past one text')
  same(PREVIEW_TEXT_DAYS.length, 2, 'follow-ups')
})

const params = {
  From: '+12815550142',
  Body: 'Looks good',
  SmsStatus: 'received',
  MessageSid: 'SM1',
}
const sign = (url, fields, token) =>
  createHmac('sha1', token)
    .update(
      Object.keys(fields)
        .sort()
        .reduce((written, name) => written + name + fields[name], url)
    )
    .digest('base64')

check('a signature is Twilio’s only when it signs this URL and these fields', () => {
  const signature = sign(TEXT_HOOK, params, 'check-token')
  ok(signedByTwilio(TEXT_HOOK, params, signature), 'a good signature is refused')
  ok(!signedByTwilio(TEXT_HOOK, { ...params, Body: 'STOP' }, signature), 'a changed body passes')
  ok(!signedByTwilio(`${TEXT_HOOK}?x=1`, params, signature), 'another URL passes')
  ok(!signedByTwilio(TEXT_HOOK, params, sign(TEXT_HOOK, params, 'other')), 'another token passes')
  ok(!signedByTwilio(TEXT_HOOK, params, ''), 'no signature passes')
})

const answer = () => {
  const said = { status: 0, body: null, headers: {} }
  return {
    said,
    status(code) {
      said.status = code
      return this
    },
    json(body) {
      said.body = body
      return this
    },
    send(body) {
      said.body = body
      return this
    },
    setHeader(name, value) {
      said.headers[name] = value
    },
    end() {
      return this
    },
  }
}

await (async () => {
  const response = answer()
  await handler(
    {
      method: 'POST',
      url: '/api/outreach/texts',
      headers: { 'x-twilio-signature': sign(TEXT_HOOK, params, 'not-the-token') },
      body: params,
    },
    response
  )
  check('the webhook refuses a post Twilio did not sign, before reading anything', () =>
    same(response.said.status, 403, 'status')
  )
})()

// Every request leaving the process is kept, and the preview's own page is
// served as it is live, so nothing reaches Twilio or the preview host.
const fetched = []
globalThis.fetch = async url => {
  fetched.push(String(url))
  return new Response(`<script>window.__SLUG__ = ${JSON.stringify(site.slug)}</script>`)
}

const textSite = { ...site, id: 'site-1', prospect_id: 'p-1', channel: 'text', sent_at: null }
const owner = {
  id: 'p-1',
  name: site.name,
  phone: '(281) 555-0142',
  stage: 'unreachable',
  replied_at: null,
}
const textPlan = extra => ({
  'select:preview_sites': { data: textSite, error: null },
  'select:outreach_prospects': { data: owner, error: null },
  'select:text_suppression': { data: null, error: null },
  'select:outreach_texts': { count: 0, error: null },
  ...extra,
})
const askText = (db, settings, body = { slug: site.slug, channel: 'text' }) =>
  previewsWork({
    db,
    settings,
    counts: { examined: 0, changed: 0 },
    request: { method: 'POST', body },
  })
const twilioCalls = () => fetched.filter(url => url.includes('api.twilio.com'))

await (async () => {
  const { db, queries } = stubDb(textPlan())
  const answer = await askText(db, {
    ...ready,
    texting_enabled: false,
    mailbox_rests_until: '2099-01-01T00:00:00Z',
    mailbox_rest_reason: 'Gmail is throttling',
  })
  check('a text preview waits on the text line, never on the mailbox', () => {
    same(answer.status, 503, 'status')
    ok(answer.skipped === 'texting is switched off', `the answer says: ${answer.skipped}`)
    same(asked(queries, 'insert:outreach_texts').length, 0, 'texts drafted')
    same(twilioCalls().length, 0, 'requests to Twilio')
  })
})()

await (async () => {
  const { db, queries } = stubDb(
    textPlan({ 'select:text_suppression': { data: { reason: 'stop' }, error: null } })
  )
  const answer = await askText(db, ready)
  check('a business whose number texted STOP is set aside, not texted', () => {
    ok(answer.note?.includes('the number is closed: stop'), `the answer says: ${answer.note}`)
    const aside = asked(queries, 'update:outreach_prospects')
    same(aside.length, 1, 'businesses set aside')
    ok(aside[0]?.payload?.preview_skipped_at, 'set aside with no time')
    same(asked(queries, 'insert:outreach_texts').length, 0, 'texts drafted')
    same(twilioCalls().length, 0, 'requests to Twilio')
  })
})()

await (async () => {
  const { db } = stubDb(textPlan({ 'select:preview_sites': { data: site, error: null } }))
  const asText = await askText(db, ready)
  check('a text asked for a preview filed to go by letter is refused', () =>
    ok(
      asText.error?.includes('filed to go by letter'),
      `the answer says: ${JSON.stringify(asText)}`
    )
  )
})()

await finish()

console.log('preview texts: all cases pass')
