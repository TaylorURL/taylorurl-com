/**
 * Proves that an enquiry can be traced back to the message that produced it,
 * at every step where the trail can be dropped without anything failing.
 *
 * Every failure this guards against is silent. A campaign that stops being
 * held still lets the form send. A conversion fired on the submit rather than
 * on the answer still shows a number in the property, just a wrong one. A tag
 * dropped on the way to the database leaves a lead filed as having come from
 * nowhere, which reads exactly like a lead that did. None of it surfaces until
 * somebody decides where to spend the next four hundred sends on figures that
 * were never right.
 *
 * The reconcile is driven through `work` with an empty mailbox rather than by
 * reaching for the pass directly. A quiet pass is where the site readings are
 * easiest to lose, because nothing else in one touches them.
 *
 *   npm run check:lead-attribution
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  CAMPAIGN_FIELDS,
  LOOKBACK_MS,
  campaignHeld,
  campaignIn,
  rememberCampaign,
} from '../src/app/data/campaign.js'
import {
  ADS_EVENT,
  CALL_EVENT,
  LEAD_EVENT,
  PIXEL_CALL_EVENT,
  PIXEL_LEAD_EVENT,
  adsSendTo,
  claimLead,
  e164,
  identityOf,
  recordCall,
  recordLead,
  recordPageView,
} from '../src/app/data/conversion.js'
import {
  campaignFrom,
  describeArrival,
  htmlBody,
  recordAttribution,
  referrerFrom,
  textBody,
} from '../api/contact.js'
import { QUESTIONS, questionsFor } from '../lib/enquiry/questions.js'
import { escapeHtml } from '../lib/mail/frame.js'
import { campaignUrl } from '../src/app/utils/emailTemplate.js'
import { SITE } from '../lib/site/current.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Nothing here may reach the network. An unstubbed path would otherwise sit on
// a real request until it timed out and pass for the wrong reason.
const OFFLINE = () => {
  throw new Error('a check reached the network')
}
globalThis.fetch = OFFLINE

const TOKEN = '5f3a1c9e-2b44-4a0d-9f11-8c2b7de6a301'
const OTHER_TOKEN = '9b70c412-6d18-4e3f-8a05-1c4de92f77b1'
const UNSUB = '11111111-1111-4111-8111-111111111111'

const OUTREACH_SEARCH = `?utm_source=outreach&utm_medium=email&utm_campaign=cold&utm_content=${TOKEN}`

// The arrival the tags cannot describe: Google's search partner network, which
// is where the enquiry that read as Direct had actually come from.
const REFERRER = 'https://syndicatedsearch.goog/'

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`)
}

/** A store that answers like `localStorage` and can be made to refuse. */
function store({ refuse = false } = {}) {
  const held = new Map()
  return {
    getItem: key => (held.has(key) ? held.get(key) : null),
    setItem(key, value) {
      if (refuse) throw new Error('the store is full')
      held.set(key, value)
    },
  }
}

/**
 * A query builder shaped like the driver's, answering whatever the case says
 * and keeping every write that passed through it.
 */
function fakeDb(answer) {
  const writes = []
  const from = table => {
    const state = { table, op: 'select', values: null, args: [] }
    const step = name =>
      function step(...args) {
        state.args.push([name, ...args])
        return chain
      }
    const chain = {
      select: step('select'),
      eq: step('eq'),
      in: step('in'),
      not: step('not'),
      order: step('order'),
      limit: step('limit'),
      insert(values) {
        state.op = 'insert'
        state.values = values
        return chain
      },
      update(values) {
        state.op = 'update'
        state.values = values
        return chain
      },
      then(resolve, reject) {
        if (state.op !== 'select') writes.push(state)
        return Promise.resolve(answer(state)).then(resolve, reject)
      },
    }
    return chain
  }
  return { db: { from }, writes }
}

// -- What the page holds on to -----------------------------------------------

check('a tagged arrival is remembered', () => {
  const held = store()
  rememberCampaign(OUTREACH_SEARCH, { store: held, now: 1000 })
  const found = campaignHeld({ store: held, now: 2000 })
  same(found.utm_source, 'outreach', 'source')
  same(found.utm_medium, 'email', 'medium')
  same(found.utm_campaign, 'cold', 'campaign')
  same(found.utm_content, TOKEN, 'content')
})

check('an untagged page leaves the campaign where it is', () => {
  const held = store()
  rememberCampaign(OUTREACH_SEARCH, { store: held, now: 1000 })
  // Every page after the first is untagged, so clearing on one would lose the
  // campaign one navigation after it arrived.
  rememberCampaign('', { store: held, now: 2000 })
  rememberCampaign('?page=2', { store: held, now: 3000 })
  same(campaignHeld({ store: held, now: 4000 })?.utm_content, TOKEN, 'content')
})

check('the newest tagged arrival replaces the one before it', () => {
  const held = store()
  rememberCampaign(OUTREACH_SEARCH, { store: held, now: 1000 })
  rememberCampaign(`?utm_source=outreach&utm_content=${OTHER_TOKEN}`, { store: held, now: 2000 })
  // A prospect sent two messages who clicked the second is answering the
  // second; crediting the first would put the count on the wrong opener.
  same(campaignHeld({ store: held, now: 3000 })?.utm_content, OTHER_TOKEN, 'content')
})

check('a campaign older than the lookback is not credited', () => {
  const held = store()
  rememberCampaign(OUTREACH_SEARCH, { store: held, now: 0 })
  same(campaignHeld({ store: held, now: LOOKBACK_MS - 1 })?.utm_content, TOKEN, 'inside')
  same(campaignHeld({ store: held, now: LOOKBACK_MS + 1 }), null, 'outside')
})

check('a clock that ran backwards is not read as a fresh arrival', () => {
  const held = store()
  rememberCampaign(OUTREACH_SEARCH, { store: held, now: 10_000 })
  same(campaignHeld({ store: held, now: 5_000 }), null, 'held')
})

check('a store that refuses costs the visit its campaign and nothing else', () => {
  const refusing = store({ refuse: true })
  same(rememberCampaign(OUTREACH_SEARCH, { store: refusing, now: 1000 }), null, 'written')
  same(campaignHeld({ store: refusing, now: 1000 }), null, 'held')
  same(rememberCampaign(OUTREACH_SEARCH, { store: null }), null, 'with no store at all')
  same(campaignHeld({ store: null }), null, 'read with no store at all')
})

check('a tag longer than its limit is cut, and its line breaks come out', () => {
  const long = 'a'.repeat(400)
  same(campaignIn(`?utm_source=news&utm_campaign=${long}`).utm_campaign.length, 200, 'length')
  same(campaignIn('?utm_source=one%0Atwo').utm_source, 'one two', 'source')
})

check('a medium with no source is not a campaign', () => {
  same(campaignIn('?utm_medium=email&utm_campaign=cold'), null, 'campaign')
  same(campaignIn(''), null, 'from nothing')
  same(campaignIn('?utm_source=%20%20'), null, 'from blank')
})

check('a stored value that is not a campaign is not read as one', () => {
  const held = store()
  held.setItem('tu_campaign', 'not json')
  same(campaignHeld({ store: held, now: 1 }), null, 'from broken json')
  held.setItem('tu_campaign', JSON.stringify({ utm_source: 'outreach' }))
  same(campaignHeld({ store: held, now: 1 }), null, 'with no stamp')
})

// -- What the tags are told ---------------------------------------------------

check('the lead event carries the held campaign', () => {
  const fired = []
  const params = recordLead('start', {
    held: campaignIn(OUTREACH_SEARCH),
    tag: (...args) => fired.push(args),
  })
  same(fired[0][0], 'event', 'call kind')
  same(fired[0][1], LEAD_EVENT, 'event name')
  same(fired[0][2].form, 'start', 'form')
  same(fired[0][2].campaign_source, 'outreach', 'source')
  same(fired[0][2].campaign_content, TOKEN, 'content')
  same(params.campaign_name, 'cold', 'campaign name')
})

check('an untagged visitor still reports the lead', () => {
  const fired = []
  recordLead('contact', { held: null, tag: (...args) => fired.push(args) })
  same(fired[0][1], LEAD_EVENT, 'event name')
  same(fired[0][2].campaign_source, '', 'source')
})

check('the lead is reported to the pixel as one of its standard events', () => {
  const fired = []
  recordLead('start', {
    held: campaignIn(OUTREACH_SEARCH),
    tag: undefined,
    pixel: (...args) => fired.push(args),
  })
  same(fired.length, 1, 'events')
  same(fired[0][0], 'track', 'call kind')
  same(fired[0][1], PIXEL_LEAD_EVENT, 'event name')
  same(fired[0][2].content_name, 'start', 'form')
  // Meta credits the conversion through the click identifier its own ads leave
  // on the visitor, so the held campaign stays with Google's event.
  same(Object.keys(fired[0][2]).join(', '), 'content_name', 'parameters')
})

check('a page where neither tag loaded reports nothing and does not raise', () => {
  same(recordLead('contact', { held: null, tag: undefined, pixel: undefined }), null, 'reported')
})

check('a navigation after the first is reported to the pixel', () => {
  const fired = []
  same(recordPageView({ pixel: (...args) => fired.push(args) }), true, 'reported')
  same(fired.length, 1, 'events')
  same(fired[0][0], 'track', 'call kind')
  same(fired[0][1], 'PageView', 'event name')
  same(recordPageView({ pixel: undefined }), false, 'with no pixel on the page')
})

// -- What the ad account is told ----------------------------------------------

check('the ad account is told beside the property, naming one action', () => {
  const fired = []
  recordLead('contact', { held: null, tag: (...args) => fired.push(args) })
  const ads = fired.filter(call => call[1] === ADS_EVENT)
  same(ads.length, 1, 'conversions')
  same(ads[0][2].send_to, SITE.adsLeadSendTo, 'action')
  // The property's event goes first, so an account that refuses the second
  // call cannot cost the property the first.
  same(fired[0][1], LEAD_EVENT, 'first event')
  // The account reads `send_to` and has no column for the campaign fields.
  same(Object.keys(ads[0][2]).join(', '), 'send_to', 'parameters')
})

check('the checkout is filed against its own action', () => {
  const fired = []
  recordLead('checkout', { held: null, tag: (...args) => fired.push(args) })
  same(fired.filter(call => call[1] === ADS_EVENT)[0][2].send_to, SITE.adsCheckoutSendTo, 'action')
  for (const form of ['contact', 'start', 'tools']) {
    same(adsSendTo(form), SITE.adsLeadSendTo, `${form} action`)
  }
})

check('a site with no ad account is told nothing', () => {
  const fired = []
  const none = { adsLeadSendTo: null, adsCallSendTo: null, adsCheckoutSendTo: null }
  recordLead('contact', { held: null, site: none, tag: (...args) => fired.push(args) })
  recordCall('nav', { held: null, site: none, tag: (...args) => fired.push(args) })
  same(fired.filter(call => call[1] === ADS_EVENT).length, 0, 'conversions')
  same(adsSendTo('checkout', none), null, 'checkout action')
})

check('every action names the one account', () => {
  const account = `${SITE.adsId}/`
  for (const [what, sendTo] of Object.entries({
    lead: SITE.adsLeadSendTo,
    call: SITE.adsCallSendTo,
    checkout: SITE.adsCheckoutSendTo,
  })) {
    same(sendTo.startsWith(account), true, `${what} account`)
    same(sendTo.slice(account.length).length > 0, true, `${what} label`)
  }
})

check('a tap on the number is its own event, not a lead', () => {
  const fired = []
  const pixeled = []
  same(
    recordCall('nav', {
      held: campaignIn(OUTREACH_SEARCH),
      tag: (...args) => fired.push(args),
      pixel: (...args) => pixeled.push(args),
    }),
    true,
    'reported'
  )
  same(fired[0][1], CALL_EVENT, 'event name')
  same(fired[0][2].where, 'nav', 'place')
  same(fired[0][2].campaign_content, TOKEN, 'content')
  same(fired[0][2].form, undefined, 'form')
  same(fired[1][2].send_to, SITE.adsCallSendTo, 'action')
  same(pixeled[0][1], PIXEL_CALL_EVENT, 'pixel event name')
  same(recordCall('nav', { tag: undefined, pixel: undefined }), false, 'with no tag on the page')
})

check('who converted is set before the conversion, and only where a form holds it', () => {
  const fired = []
  recordLead('contact', {
    held: null,
    person: { name: 'Ada Lovelace', email: ' ADA@Example.COM ', phone: '(281) 862-8687' },
    tag: (...args) => fired.push(args),
  })
  const set = fired.findIndex(call => call[0] === 'set')
  same(set > -1, true, 'identity')
  same(set < fired.findIndex(call => call[1] === ADS_EVENT), true, 'set before the conversion')
  same(fired[set][1], 'user_data', 'what is set')
  same(fired[set][2].email, 'ada@example.com', 'email')
  same(fired[set][2].phone_number, '+12818628687', 'phone')
  same(fired[set][2].address.last_name, 'Lovelace', 'surname')

  const without = []
  recordLead('contact', { held: null, tag: (...args) => without.push(args) })
  same(without.filter(call => call[0] === 'set').length, 0, 'identity with nothing to send')
})

check('an identity carries only the fields a form actually holds', () => {
  // The checkout knows an email and a business, not a person, so the address
  // Google would match a name against is left off rather than filled with the
  // business. A field that cannot be filled honestly is not sent.
  same(identityOf({ email: 'a@b.com' }).address, undefined, 'address')
  same(identityOf({ email: 'a@b.com' }).phone_number, undefined, 'phone')
  same(identityOf({ name: 'Ada', email: 'a@b.com' }).address, undefined, 'a single name')
  same(identityOf({ phone: '2818628687' }), null, 'with no email')
  same(identityOf(null), null, 'with no person at all')
})

check('a number Google could not read is left out rather than guessed at', () => {
  same(e164('281-862-8687'), '+12818628687', 'ten digits')
  same(e164('+1 (281) 862-8687'), '+12818628687', 'eleven beginning with a one')
  for (const wrong of ['', '  ', '5551234', '+44 20 7946 0958', 'call me', null, undefined]) {
    same(e164(wrong), null, `from ${JSON.stringify(wrong)}`)
  }
})

// -- What the endpoint is sent ------------------------------------------------

check('a delivered enquiry reports one conversion and carries its campaign', async () => {
  const sent = []
  const fired = []
  const pixeled = []
  globalThis.localStorage = store()
  globalThis.location = { pathname: '/start', search: OUTREACH_SEARCH }
  globalThis.gtag = (...args) => fired.push(args)
  globalThis.fbq = (...args) => pixeled.push(args)
  rememberCampaign(OUTREACH_SEARCH, { store: globalThis.localStorage })
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) })
    return { ok: true }
  }
  try {
    const { submitEnquiry } = await import('../src/app/data/sendEnquiry.js')
    await submitEnquiry({ form: 'start', name: 'Ada', email: 'a@b.com', message: 'hello there' })
    same(sent.length, 1, 'requests')
    same(sent[0].url, '/api/contact', 'endpoint')
    same(sent[0].body.form, 'start', 'form')
    same(sent[0].body.path, '/start', 'path')
    same(sent[0].body.campaign.utm_content, TOKEN, 'content')
    same(fired[0][1], LEAD_EVENT, 'event name')
    same(pixeled.length, 1, 'pixel conversions')
    same(pixeled[0][1], PIXEL_LEAD_EVENT, 'pixel event name')
  } finally {
    globalThis.fetch = OFFLINE
  }
})

check('the enquiry hands over who wrote in, and the checkout hands over what it has', async () => {
  // The identity is assembled inside recordLead, so a call site that stops
  // passing `person` costs enhanced conversions everything and breaks nothing:
  // the conversion still fires, still counts, and simply stops matching. This
  // is the only place that would notice.
  for (const [form, sent, expected] of [
    [
      'contact',
      { name: 'Ada Lovelace', email: 'ada@example.com', phone: '281-862-8687' },
      { email: 'ada@example.com', phone_number: '+12818628687', last_name: 'Lovelace' },
    ],
    // No phone on this one: the field is optional on three of the four forms,
    // and an identity that invented one would match the wrong person.
    [
      'start',
      { name: 'Ada Lovelace', email: 'ada@example.com' },
      { email: 'ada@example.com', phone_number: undefined, last_name: 'Lovelace' },
    ],
  ]) {
    const fired = []
    globalThis.localStorage = store()
    globalThis.location = { pathname: '/contact', search: '', host: 'www.taylorurl.com' }
    globalThis.document = { referrer: '' }
    globalThis.gtag = (...args) => fired.push(args)
    globalThis.fetch = async () => ({ ok: true })
    try {
      const { submitEnquiry } = await import('../src/app/data/sendEnquiry.js')
      await submitEnquiry({ form, message: 'hello there', ...sent })
      const set = fired.find(call => call[0] === 'set' && call[1] === 'user_data')
      same(Boolean(set), true, `${form} identity`)
      same(set?.[2].email, expected.email, `${form} email`)
      same(set?.[2].phone_number, expected.phone_number, `${form} phone`)
      same(set?.[2].address?.last_name, expected.last_name, `${form} surname`)
    } finally {
      globalThis.fetch = OFFLINE
    }
  }

  const fired = []
  globalThis.localStorage = store()
  globalThis.gtag = (...args) => fired.push(args)
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ url: 'https://stripe.test/c' }),
  })
  try {
    const { openCheckout } = await import('../src/app/data/startCheckout.js')
    await openCheckout({ email: ' BUYER@Example.COM ', termsAccepted: true })
    const set = fired.find(call => call[0] === 'set' && call[1] === 'user_data')
    same(set?.[2].email, 'buyer@example.com', 'checkout email')
    // The checkout knows a business, not a person, so there is no name to match
    // on and none is invented.
    same(set?.[2].address, undefined, 'checkout address')
    same(
      fired.find(call => call[1] === ADS_EVENT)?.[2].send_to,
      SITE.adsCheckoutSendTo,
      'checkout action'
    )
  } finally {
    globalThis.fetch = OFFLINE
  }
})

check('an untagged enquiry carries the page it came in from', async () => {
  const sent = []
  globalThis.localStorage = store()
  globalThis.location = { pathname: '/contact', search: '', host: 'www.taylorurl.com' }
  globalThis.document = { referrer: REFERRER }
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body))
    return { ok: true }
  }
  try {
    const { submitEnquiry } = await import('../src/app/data/sendEnquiry.js')
    await submitEnquiry({ form: 'contact', name: 'Ada', email: 'a@b.com', message: 'hello there' })
    same(sent[0].campaign, null, 'campaign')
    same(sent[0].referrer, REFERRER, 'referrer')

    // One page of a visit pointing at the next says nothing about where the
    // visit came from, so it is not reported as a source.
    globalThis.document = { referrer: 'https://www.taylorurl.com/pricing' }
    await submitEnquiry({ form: 'contact', name: 'Ada', email: 'a@b.com', message: 'hello there' })
    same(sent[1].referrer, '', 'from this site')

    globalThis.document = { referrer: '' }
    await submitEnquiry({ form: 'contact', name: 'Ada', email: 'a@b.com', message: 'hello there' })
    same(sent[2].referrer, '', 'from nowhere')
  } finally {
    globalThis.fetch = OFFLINE
    delete globalThis.document
  }
})

check('a refused enquiry reports no conversion', async () => {
  const fired = []
  const pixeled = []
  globalThis.gtag = (...args) => fired.push(args)
  globalThis.fbq = (...args) => pixeled.push(args)
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: 'no' }) })
  try {
    const { submitEnquiry } = await import('../src/app/data/sendEnquiry.js')
    let raised = null
    try {
      await submitEnquiry({ form: 'contact', name: 'Ada', email: 'a@b.com', message: 'hello' })
    } catch (cause) {
      raised = cause
    }
    same(Boolean(raised), true, 'the caller was told')
    // A form refused for a missing field is not a lead, and counting the
    // attempt would put a conversion against every mistyped address.
    same(fired.length, 0, 'conversions')
    same(pixeled.length, 0, 'pixel conversions')
  } finally {
    globalThis.fetch = OFFLINE
    delete globalThis.gtag
    delete globalThis.fbq
  }
})

// -- What the endpoint keeps --------------------------------------------------

check('an outreach tag that is not a message token is dropped', () => {
  // The column is joined against outreach_messages and read in a log, so it
  // takes the shape a message token has and nothing else.
  const found = campaignFrom({ utm_source: 'outreach', utm_content: 'owner@example.com' })
  same(found.utm_source, 'outreach', 'source')
  same(found.utm_content, '', 'content')
  same(
    campaignFrom({ utm_source: 'outreach', utm_content: TOKEN }).utm_content,
    TOKEN,
    'a real one'
  )
})

check('a tag under another source is kept as it stands', () => {
  same(
    campaignFrom({ utm_source: 'newsletter', utm_content: 'week-12-header' }).utm_content,
    'week-12-header',
    'content'
  )
})

check('a body with no source files no campaign', () => {
  same(campaignFrom({ utm_medium: 'email' }), null, 'campaign')
  same(campaignFrom(null), null, 'from nothing')
  same(campaignFrom('outreach'), null, 'from a string')
})

check('the inbox line names where a lead came from', () => {
  same(describeArrival({}), 'Direct', 'with nothing at all')
  const campaign = campaignFrom({
    utm_source: 'outreach',
    utm_medium: 'email',
    utm_campaign: 'cold',
    utm_content: TOKEN,
  })
  same(describeArrival({ campaign }), `outreach / email / cold - tag ${TOKEN}`, 'with a campaign')
})

check('an untagged lead names the page it came in from', () => {
  // Most arrivals carry no tags, and reading the tags alone reported every one
  // of them as Direct. A real source that reports as no source is a source
  // nobody spends against.
  same(describeArrival({ referrer: REFERRER }), REFERRER, 'with a referrer')
  same(describeArrival({ referrer: '' }), 'Direct', 'with neither')
  // A tagged arrival says which message brought them, which is the stronger
  // answer of the two, so the referrer does not displace it.
  const campaign = campaignFrom({ utm_source: 'newsletter' })
  same(describeArrival({ campaign, referrer: REFERRER }), 'newsletter', 'with both')
})

check('a referrer is taken only in the shape a referrer has', () => {
  same(referrerFrom(REFERRER), REFERRER, 'an address')
  same(referrerFrom('javascript:alert(1)'), '', 'a script')
  same(referrerFrom('Call 555-0142 about your domain'), '', 'a sentence')
  same(referrerFrom(undefined), '', 'nothing')
  same(referrerFrom(`https://example.com/${'a'.repeat(400)}`).length, 300, 'longer than its limit')
})

check('a delivered enquiry is filed with its campaign and nothing about the sender', async () => {
  const { db, writes } = fakeDb(() => ({ error: null }))
  const filed = await recordAttribution(
    {
      form: 'contact',
      path: '/contact',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'hello there',
      campaign: campaignFrom({ utm_source: 'outreach', utm_content: TOKEN }),
    },
    db
  )
  same(filed, true, 'filed')
  same(writes.length, 1, 'writes')
  same(writes[0].table, 'enquiry_attribution', 'table')
  same(writes[0].values.utm_content, TOKEN, 'content')
  same(writes[0].values.form, 'contact', 'form')
  // The row answers which message produced an enquiry and cannot answer who
  // sent it, so a leak of the table names nobody.
  const allowed = new Set(['form', 'path', ...CAMPAIGN_FIELDS])
  same(
    Object.keys(writes[0].values)
      .filter(key => !allowed.has(key))
      .join(', '),
    '',
    'fields filed beyond the campaign and the form'
  )
})

check('the page a visit came in from reaches the notice and not the table', async () => {
  // The referrer answers a question about the person rather than about the
  // campaign, and the table has no column for it. It rides as far as the inbox.
  const { db, writes } = fakeDb(() => ({ error: null }))
  await recordAttribution(
    { form: 'contact', path: '/contact', campaign: null, referrer: REFERRER },
    db
  )
  same(Object.keys(writes[0].values).includes('referrer'), false, 'filed')
  same(
    JSON.stringify(writes[0].values).includes('syndicatedsearch'),
    false,
    'filed under another name'
  )
})

check('a deployment with no database key files nothing and raises nothing', async () => {
  same(await recordAttribution({ form: 'contact', campaign: null }, null), false, 'filed')
})

check('a refused write is read rather than ignored', async () => {
  const said = []
  const spoke = console.error
  console.error = (...args) => said.push(args.join(' '))
  try {
    const { db } = fakeDb(() => ({ error: { message: 'permission denied' } }))
    // The enquiry is already in the inbox by this point, so a refusal costs a
    // figure rather than a lead and is logged rather than raised.
    same(await recordAttribution({ form: 'contact', campaign: null }, db), false, 'filed')
    same(said.length, 1, 'lines logged')
    same(said[0].includes('permission denied'), true, `the reason survives: ${said[0]}`)
  } finally {
    console.error = spoke
  }
})

// -- What the notice says ------------------------------------------------------

/** One delivered enquiry, as the endpoint hands it to the two renderers. */
function enquiry(fields = {}) {
  return {
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    company: 'Bayside Karting',
    projectType: 'A new website',
    contactMethod: 'phone',
    phone: '555-0142',
    message: 'We need somewhere people can book a party.',
    form: 'contact',
    path: '/contact',
    campaign: null,
    referrer: '',
    ...fields,
  }
}

check('every answer in the notice carries the question that produced it', () => {
  // A label that is not the question is a label that has to be checked against
  // the live form before it can be trusted, and the written answer arrived
  // under no label at all.
  const text = textBody(enquiry())
  const html = htmlBody(enquiry())
  const lines = text.split('\n')
  for (const question of Object.values(QUESTIONS.contact)) {
    same(
      lines.some(row => row.startsWith(question)),
      true,
      `the text half asks ${question}`
    )
    same(html.includes(`>${question}</td>`), true, `the laid-out half asks ${question}`)
  }
  // A question already ending in a question mark takes no colon after it.
  same(text.includes('How should I get back to you? Phone call'), true, 'how to answer')
  same(text.includes('What the site has to do:'), true, 'the written answer has its question')
  same(text.includes('Message:'), false, 'the label that named no question is gone')
})

check('the notice reads the form its enquiry came off', () => {
  const off = enquiry({ form: 'tools', company: '', projectType: 'Google Presence Check' })
  const text = textBody(off)
  // A tool asks what you need and never asks for a business name, so a row
  // saying one was not given would report a question nobody was put.
  same(text.includes('What you need:'), true, 'the question the tool asked')
  same(text.includes('Business name:'), false, 'a question it never asked')
  same(text.includes('Which tool: Google Presence Check'), true, 'what the tool named itself')
  same(textBody(enquiry({ form: 'nonsense' })).includes('Business name:'), true, 'an older form')
})

check('the notice names an untagged arrival', () => {
  same(textBody(enquiry({ referrer: REFERRER })).includes(`Came from: ${REFERRER}`), true, 'source')
  same(textBody(enquiry()).includes('Came from: Direct'), true, 'with nothing to name')
  // The address is a stranger's and it is read by a person, so it is reported
  // as text rather than as something to press.
  same(htmlBody(enquiry({ referrer: REFERRER })).includes(`href="${REFERRER}`), false, 'as a link')
})

check('the written answer reaches the inbox exactly as it was typed', () => {
  // A duplicated word and a typo are what the sender wrote, and either one may
  // be the thing worth reading.
  const typed = 'we we need a a site\n\n  that that books partys  '
  const carried = enquiry({ message: typed })
  same(textBody(carried).endsWith(typed), true, `the text half:\n${textBody(carried)}`)
  same(htmlBody(carried).includes(escapeHtml(typed)), true, 'the laid-out half')
})

check('the configurator still has a way out that is not a card', () => {
  // The get-in-touch step was taken out of this flow once before, and nothing
  // failed when it went: the page built, the checkout worked, and the only
  // symptom was that the visitors who were not ready to pay stopped leaving a
  // trace. Two of the four enquiries on record had come in through it.
  //
  // So the arrangement is held here rather than remembered. The panel has to
  // exist, it has to file as its own form, and the configurator has to mount it
  // somewhere a visitor reaches before the payment screen.
  const panel = readFileSync(join(ROOT, 'src/app/views/start/SaveSection.jsx'), 'utf8')
  same(/form:\s*'start'/.test(panel), true, 'the panel files as the configurator')
  same(panel.includes('submitEnquiry'), true, 'the panel sends an enquiry')

  const view = readFileSync(join(ROOT, 'src/app/views/Start.jsx'), 'utf8')
  same(view.includes('SaveSection'), true, 'the configurator mounts the panel')

  // Steps are counted from zero and the payment is the last of five, so a set
  // that reached it would be offering the panel beside the card.
  const steps = view.match(/const SAVEABLE = new Set\(\[([^\]]*)\]\)/)
  same(Boolean(steps), true, 'the steps the panel stands under are named')
  const offered = steps[1]
    .split(',')
    .map(part => Number(part.trim()))
    .filter(part => Number.isInteger(part))
  same(offered.length > 0, true, 'the panel is offered on at least one step')
  same(Math.max(...offered) < 4, true, 'the panel is never offered beside the card')
  same(Math.min(...offered) > 0, true, 'the panel waits until something has been picked')
})

check('the pay step carries the answers to the enquiry rather than dropping them', () => {
  // The second button on the payment screen is the visitor saying they want to
  // talk first. It used to be a bare link, so five screens of picking were lost
  // on the way and the contact form opened empty in front of the one visitor
  // who had told the site the most.
  const pay = readFileSync(join(ROOT, 'src/app/views/start/PaySection.jsx'), 'utf8')
  same(/to="\/contact"\s+state=\{\{\s*brief:\s*summary\s*\}\}/.test(pay), true, 'the brief travels')

  const contact = readFileSync(join(ROOT, 'src/app/views/Contact.jsx'), 'utf8')
  same(contact.includes('briefText(state?.brief)'), true, 'the contact form reads it')
})

check('a form renders its labels from the questions the notice reports', () => {
  // Written twice, the two drift, which is how the notice came to describe a
  // form that had been reworded underneath it. Every label and legend on an
  // enquiry form reads from the shared set, so a question typed straight into
  // the markup is a question the inbox will not have heard about.
  const views = [
    'src/app/views/Contact.jsx',
    'src/app/views/tools/ToolEnquiry.jsx',
    'src/app/views/start/SaveSection.jsx',
    'src/app/components/ContactMethodChoice.jsx',
  ]
  let found = 0
  for (const path of views) {
    const source = readFileSync(join(ROOT, path), 'utf8')
    for (const [, , inner] of source.matchAll(/<(label|legend)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const said = inner.trim()
      // The choice tiles wrap their own radio rather than naming a field, so
      // the ones with markup inside them are not labels over an answer.
      if (said.includes('<')) continue
      found += 1
      same(/^\{(ASKED|REPLY_QUESTIONS)\.\w+\}$/.test(said), true, `${path}: ${said}`)
    }
  }
  same(found, 12, 'labels read')
  same(questionsFor('contact').message, 'What the site has to do', 'the contact page still asks it')
})

// -- What the console can answer ----------------------------------------------

/** One watch pass over a mailbox with nothing in it. */
async function reconcile(rows, message = {}) {
  const held = { id: 'm1', track_token: TOKEN, clicked_at: null, enquired_at: null, ...message }
  const { db, writes } = fakeDb(state => {
    if (state.table === 'outreach_messages' && state.op === 'select') {
      return { data: [held], error: null }
    }
    if (state.table === 'analytics_events') return { data: [], error: null }
    if (state.table === 'enquiry_attribution') return { data: rows, error: null }
    return { error: null }
  })
  process.env.OUTREACH_SMTP_USER = 'sender@example.com'
  process.env.OUTREACH_SMTP_PASSWORD = 'secret'
  const { work } = await import('../api/outreach/watch.js')
  const counts = { examined: 0, changed: 0 }
  const result = await work({ db, counts, read: async () => [] })
  return { result, writes, counts }
}

check('an enquiry on a message token marks the message', async () => {
  const { result, writes } = await reconcile([
    { utm_content: TOKEN, created_at: '2026-08-29T10:00:00.000Z' },
  ])
  same(result.enquiries, 1, 'enquiries')
  const written = writes.find(row => row.table === 'outreach_messages')
  same(written.values.enquired_at, '2026-08-29T10:00:00.000Z', 'enquired_at')
  same(written.values.enquiry_count, 1, 'count')
  same(written.args.at(-1)[1], 'id', 'the update is keyed on the message')
})

check('the first enquiry is kept and the count is what was seen', async () => {
  const { writes } = await reconcile(
    [
      { utm_content: TOKEN, created_at: '2026-08-29T12:00:00.000Z' },
      { utm_content: TOKEN, created_at: '2026-08-28T09:00:00.000Z' },
      { utm_content: TOKEN, created_at: '2026-08-29T18:00:00.000Z' },
    ],
    { enquired_at: '2026-08-27T08:00:00.000Z' }
  )
  const written = writes.find(row => row.table === 'outreach_messages')
  same(written.values.enquired_at, '2026-08-27T08:00:00.000Z', 'the first is held')
  same(written.values.last_enquiry_at, '2026-08-29T18:00:00.000Z', 'the last moves')
  same(written.values.enquiry_count, 3, 'count')
})

check('an enquiry against another message is not credited to this one', async () => {
  const { result, writes } = await reconcile([
    { utm_content: OTHER_TOKEN, created_at: '2026-08-29T10:00:00.000Z' },
  ])
  same(result.enquiries, 0, 'enquiries')
  same(writes.filter(row => row.table === 'outreach_messages').length, 0, 'messages written')
})

check('a quiet mailbox still reads what the site saw', async () => {
  // The site readings do not depend on the mailbox, so a pass that finds no
  // mail still takes them. Without that, a message clicked on a day nobody
  // replied stays unread until somebody happens to write in.
  const { result, counts } = await reconcile([
    { utm_content: TOKEN, created_at: '2026-08-29T10:00:00.000Z' },
  ])
  same(result.read, 0, 'messages read')
  same(result.enquiries, 1, 'enquiries')
  same(counts.changed, 1, 'changed')
})

// -- What must not have moved -------------------------------------------------

check('the outreach link still carries all four tags', async () => {
  process.env.OUTREACH_POSTAL_ADDRESS = '1 Example St, Baytown TX 77520'
  const { compose } = await import('../api/outreach/send.js')
  const prospect = {
    id: 'p1',
    name: 'Bayou Roofing',
    town: 'Baytown',
    trade: 'roofing',
    website: 'https://example.com',
    site_kind: 'own',
    audit_score: 41,
    email: 'owner@example.com',
    unsub_token: UNSUB,
  }
  const { text, html } = compose(prospect, null, TOKEN)
  // The one door the letter carries: the studio's address under the sign-off.
  // The tags ride in the laid-out half's href, where a mail client keeps them
  // and a reader never sees them, because a cold introduction printing a
  // hundred characters of tracking mid-signature stops reading as something a
  // person typed. What has to survive is the tagging itself, since that is
  // what tells a lead from a stranger.
  const link = html.match(/https?:\/\/\S*?[?&]utm_[^"'\s]*/)?.[0] ?? ''
  same(Boolean(link), true, `no tagged link in the laid-out half:\n${html}`)
  for (const tag of ['utm_source=outreach', 'utm_medium=email', 'utm_campaign=cold']) {
    same(link.includes(tag), true, `the laid-out half carries ${tag}`)
  }
  same(html.includes(`utm_content=${TOKEN}`), true, 'the laid-out half carries the message token')
  // The plain half shows the address as a person would type it. A reader who
  // types it in arrives untagged, which is the same thing that happens to
  // anybody who reads the address off a van.
  same(text.includes('www.taylorurl.com'), true, `no studio address in the text half:\n${text}`)
  // The unsubscribe link acts on a row and the attribution tag lands in a log
  // and an analytics property, so the two are never the same value.
  same(html.includes(`utm_content=${UNSUB}`), false, 'the tag is not the unsubscribe credential')
})

check('a newsletter link is still tagged, and one already tagged is left alone', () => {
  const site = 'https://www.taylorurl.com'
  const tagged = campaignUrl(`${site}/blog`, 'week-12', site)
  same(tagged.includes('utm_source=newsletter'), true, 'source')
  same(tagged.includes('utm_campaign=week-12'), true, 'campaign')
  const already = `${site}/blog?utm_source=outreach`
  same(campaignUrl(already, 'week-12', site), already, 'a link that was already tagged')
  const away = 'https://elsewhere.example/x'
  same(campaignUrl(away, 'week-12', site), away, 'another host')
})

check('every enquiry form names itself', () => {
  // A third form added without a name would be counted as the contact page,
  // which is worse than not being counted at all.
  const views = ['src/app/views/Contact.jsx', 'src/app/views/tools/ToolEnquiry.jsx']
  let found = 0
  for (const path of views) {
    const source = readFileSync(join(ROOT, path), 'utf8')
    for (const at of source.matchAll(/submitEnquiry\(/g)) {
      found += 1
      const call = source.slice(at.index, at.index + 260)
      same(/\bform:\s*'(contact|start|tools)'/.test(call), true, `${path} names its form`)
    }
  }
  same(found, views.length, 'call sites')
})

check('the configurator reports the address it was given', () => {
  // The step the ads point at. Until this reported, the only conversion the
  // account could see came from forms further down the site that almost
  // nobody reaches, so the campaign was optimised toward cheap visits.
  const source = readFileSync(join(ROOT, 'src/app/data/startLead.js'), 'utf8')
  same(/\brecordLead\(\s*'start'/.test(source), true, 'reports the lead')
  same(/\bclaimLead\(\s*'start'/.test(source), true, 'reports it once')
})

check('one visitor answering five screens is one lead', () => {
  // `recordStart` runs on a settle timer at every screen and again as the tab
  // closes. Counted per call, one person would arrive as five conversions and
  // every cost-per-lead figure would read a fifth of what it is.
  const held = store()
  const seen = new Set()
  const claims = []
  for (let screen = 0; screen < 5; screen += 1) {
    claims.push(claimLead('start', 'owner@example.com', { store: held, here: seen }))
  }
  same(claims.filter(Boolean).length, 1, 'claims across five reports')
})

check('the brief at the end does not count the visitor twice', () => {
  // The configurator asks for the address on screen one and submits it again
  // under the same form at the end. That is one person deciding once.
  const held = store()
  const seen = new Set()
  same(claimLead('start', 'owner@example.com', { store: held, here: seen }), true, 'first step')
  same(
    claimLead('start', 'owner@example.com', { store: held, here: seen }),
    false,
    'the brief behind it'
  )
})

check('a different form under the same address still counts', () => {
  // Somebody who configures a site and later writes from the contact page has
  // done two separate things, and the second is the one worth replying to.
  const held = store()
  const seen = new Set()
  same(claimLead('start', 'owner@example.com', { store: held, here: seen }), true, 'configurator')
  same(claimLead('contact', 'owner@example.com', { store: held, here: seen }), true, 'contact page')
})

check('an address is claimed case-insensitively and without its padding', () => {
  const held = store()
  const seen = new Set()
  same(claimLead('start', 'Owner@Example.com ', { store: held, here: seen }), true, 'as typed')
  same(claimLead('start', 'owner@example.com', { store: held, here: seen }), false, 'as stored')
})

check('a browser refusing its session store still reports once', () => {
  // Safari with cookies blocked throws on the write rather than answering
  // empty. The page's own memory carries the rest of the visit.
  const refusing = store({ refuse: true })
  const seen = new Set()
  same(claimLead('start', 'owner@example.com', { store: refusing, here: seen }), true, 'first')
  same(claimLead('start', 'owner@example.com', { store: refusing, here: seen }), false, 'second')
})

check('an empty address claims nothing', () => {
  const held = store()
  const seen = new Set()
  same(claimLead('start', '', { store: held, here: seen }), false, 'blank')
  same(claimLead('start', '   ', { store: held, here: seen }), false, 'spaces')
})

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const line of failures) console.error(line)
  console.error(`lead attribution: ${failures.length} of ${cases.length} cases failed`)
  process.exit(1)
}

console.log(
  `lead attribution: all ${cases.length} cases pass - the campaign is held for ` +
    `${LOOKBACK_MS / 86_400_000} days, every form reports ${LEAD_EVENT} and one action in ` +
    'the ad account, and an enquiry reaches the message that produced it'
)
