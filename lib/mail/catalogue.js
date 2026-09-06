/**
 * Every message the studio sends, and the sample each one is drawn from.
 *
 * Most of what leaves this site keeps nothing of what it sent. An outreach
 * draft is stored whole and the newsletter stores the issue and renders the
 * letter again from it; the enquiry notice, the two notices the studio sends
 * itself and the signup confirmation exist nowhere but in the inbox they
 * landed in. A console that listed only what a table holds would say the
 * studio sends one kind of message.
 *
 * So a family that keeps no history is still a message that can be looked at,
 * drawn here from a sample rather than from a row. The sample is a real
 * business off the sourcing list and a real issue's worth of blocks, because a
 * frame checked against a placeholder is a frame checked against nothing: the
 * lines that break are the long trade name and the heading that runs to two
 * lines, and a placeholder has neither.
 *
 * Every body is rendered by the code that sends it. Nothing here retypes a
 * message, so a sample that looks right is the message being right.
 */

import { compose } from '../../api/outreach/send.js'
import { variantById } from '../outreach/variants.js'
import { confirmationBodies } from './message.js'
import { followUpMessage } from '../leads/message.js'
import { notice } from './notice.js'
import { METHOD_LABELS, htmlBody, textBody } from '../../api/contact.js'
import { replyNotice } from '../../api/outreach/watch.js'
import { speedCheckNotice } from '../../api/speed-check.js'
import { openArgs, purchaseNotice, purchaseOf } from '../../api/stripe-webhook.js'
// Aliased because the samples below are prospects in the outreach sense, and
// these two are the sides of the mailing list.
import { CLIENT as CLIENT_SIDE, PROSPECT as PROSPECT_SIDE } from './audience.js'
import { renderIssueEmail } from '../../src/app/utils/emailTemplate.js'
import { clientNotice, readNotification } from './notify.js'
import { capturedIcon, iconGround } from '../../src/app/data/siteIcons.js'

const SITE = 'https://www.taylorurl.com'

// One invented business across the whole page, so the reading and the business
// named in it are one business rather than two.
const PROSPECT = {
  name: 'Bayside Electrical',
  town: 'Baytown',
  trade: 'electrician',
  website: 'http://example.com/',
  audit_score: 61,
  site_kind: 'site',
  unsub_token: 'preview',
}

// A prospect whose listing points at a platform takes the other opener, so the
// second cold message is a different letter rather than the same one twice.
const PROSPECT_NO_SITE = {
  ...PROSPECT,
  name: 'Northside Lawn Care',
  town: 'Highlands',
  trade: 'lawn care',
  website: null,
  audit_score: null,
  site_kind: 'social',
}

// An issue with the blocks a real one is written from. The bio sits in the
// footer, which draws the same way whatever the body holds.
// A measured business as the pipeline holds one once PageSpeed has answered,
// with the report the plain letters read their seconds and their causes from.
const PROSPECT_MEASURED = {
  ...PROSPECT,
  name: 'Harbor Point Pest Control',
  town: 'Highlands',
  trade: 'pest control',
  email: 'owner@example.com',
  website: 'https://www.example.com/',
  audit_score: 39,
  accessibility_score: 71,
  best_practices_score: 78,
  seo_score: 85,
  site_kind: 'own',
  audit_raw: {
    metrics: { largest_contentful_paint: { numeric: 13813 } },
    opportunities: [
      { id: 'unused-javascript', title: 'Reduce unused JavaScript', savings_ms: 760 },
      { id: 'redirects', title: 'Avoid multiple page redirects', savings_ms: 630 },
      { id: 'modern-image-formats', title: 'Serve images in next-gen formats', savings_ms: 400 },
    ],
  },
}

/** Which letter each plain preview renders, and the business it renders for. */
const PLAIN_SAMPLES = {
  'outreach-plain-speed': { id: 'slow-site-plain', row: PROSPECT_MEASURED },
  'outreach-plain-search': { id: 'slow-site-plain-search', row: PROSPECT_MEASURED },
  'outreach-plain-nearby': { id: 'slow-site-plain-nearby', row: PROSPECT_MEASURED },
  'outreach-plain-last': { id: 'slow-site-plain-last', row: PROSPECT_MEASURED },
  'outreach-plain-listing': { id: 'no-site-plain', row: PROSPECT_NO_SITE },
  'outreach-intro': { id: 'slow-site-intro', row: PROSPECT_MEASURED },
  'outreach-intro-process': { id: 'slow-site-intro-process', row: PROSPECT_MEASURED },
  'outreach-intro-pointer': { id: 'slow-site-intro-pointer', row: PROSPECT_MEASURED },
}

const ISSUE = {
  title: 'Three things that decide whether Google shows your business',
  preheader: 'The parts of a listing that move, and the parts that do not.',
  body: [
    {
      type: 'paragraph',
      text: 'Most of what decides whether a local business turns up in a search is settled before anyone writes a word of a website. Here are the three that matter most.',
    },
    { type: 'heading', level: 2, text: 'The listing has to say where you work' },
    {
      type: 'paragraph',
      text: 'A service area named town by town is read differently from one that names a county. The towns are what people type.',
    },
    // One block for each side, so the sample draws the two letters an issue
    // actually is rather than the same letter twice.
    {
      type: 'paragraph',
      audience: 'client',
      text: 'Your own listing is already set this way, and the console shows what it is bringing in.',
    },
    {
      type: 'paragraph',
      audience: 'prospect',
      text: 'A reading of your site takes about a minute and comes back with the same four grades Google files.',
    },
    { type: 'button', audience: 'prospect', text: 'Run the reading', href: `${SITE}/speed-check` },
  ],
}

const SUBSCRIBER = { unsub_token: 'preview', source: 'taylorurl' }

// The same business again, this time having run the reading themselves. One
// business across the page is what makes two notices about the same site read
// as two notices rather than as two samples.
const SPEED_CHECK = {
  email: 'owner@example.com',
  site: PROSPECT.website,
  host: 'example.com',
  score: PROSPECT.audit_score,
  band: 'slow',
  suppressed: false,
}

// A reply as the mailbox hands one over, from a prospect the pipeline has
// written to. The unmatched case draws the same frame with the business
// columns empty, so the matched one is the sample worth keeping.
const REPLY = {
  from: 'owner@example.com',
  subject: 'Re: your website on a phone',
  body: 'We know it is slow. What would it cost to have it done properly, and how long does it take?',
}

// An enquiry with every field the contact form asks filled, since the notice
// lays out whichever of them arrived and the empty ones are the easy case. It
// carries a referrer and no tags, which is what most arrivals look like: the
// reading has to name where an untagged visit came in from, because that is
// the one the campaign cannot answer for.
const ENQUIRY = {
  name: 'Dana Whitfield',
  email: 'dana@example.com',
  company: 'Bayside Karting',
  projectType: 'A new website',
  contactMethod: 'phone',
  phone: '555-0142',
  message:
    'We need somewhere people can see the track times and book a party without ringing us. Whatever you did for the go-kart place, that.',
  form: 'contact',
  path: '/contact',
  campaign: null,
  referrer: 'https://syndicatedsearch.goog/',
}

// A project as `notify_projects` holds one, and the notification its own
// deployment posts. A real site the studio runs rather than an invented one,
// because the thing this family has to survive is a client's mark: every one
// the console holds is a badge that says nothing on its own, drawn on whichever
// ground its artwork reads on, and a sample with a wordmark in place of one
// would prove the masthead draws for the one case that never happens.
const CLIENT_HOST = 'baytowngokarts.com'

const CLIENT_PROJECT = {
  slug: 'speedway-146',
  name: 'Speedway 146',
  from_name: 'Speedway 146',
  from_address: 'notifications@taylorurl.com',
  reply_to: null,
  accent: '#c2410c',
  mark_url: capturedIcon(CLIENT_HOST),
  mark_ground: iconGround(CLIENT_HOST),
  site_url: `https://www.${CLIENT_HOST}`,
  link_label: 'Open The Booking Desk',
  footer_line: `Speedway 146 \u00b7 ${CLIENT_HOST}`,
}

// What a deployment posts: a heading, a short reading of the facts, and one
// thing to open. A booking that took the money and never landed is the shape
// worth drawing, because it is the one where the reading matters more than the
// heading and the reader is going to act on it from a phone.
const CLIENT_NOTIFICATION = {
  subject: 'A booking was paid for and never landed',
  severity: 'urgent',
  lines: [
    ['Booking', 'BK-4192'],
    ['Party', 'Whitfield, 8 drivers'],
    ['Session', 'Saturday 2:30 PM'],
    ['Taken', '$264.00'],
  ],
  body: 'The payment cleared and the slot was never written to the calendar, so the session is still showing as open to everybody else.',
  link: { url: `https://www.${CLIENT_HOST}/desk/bookings/BK-4192` },
}

// A paid session as Stripe delivers one, rather than a purchase built by hand.
// The sample is put through the same two readers a live payment is - the
// arguments the project is opened with, then the purchase drawn off them - so
// the figures on the preview are the figures the endpoint would record, and a
// change to either reader shows up here instead of shipping unseen.
//
// The business is the measured one above, because the purchase worth drawing is
// the one where a cold message became a sale: the same name runs through the
// letter, the reading and this, so the console shows one business being sold to
// rather than three unrelated ones. A subscription session carrying no quoted
// figure is a checkout off the pricing page, which is what most of them are.
const PURCHASE_SESSION = {
  id: 'cs_live_a1B2c3D4e5F6g7H8',
  mode: 'subscription',
  customer: 'cus_SaMpLe00001',
  payment_intent: 'pi_SaMpLe00001',
  subscription: 'sub_SaMpLe00001',
  metadata: {
    business_name: PROSPECT_MEASURED.name,
    website: PROSPECT_MEASURED.website,
  },
}

/**
 * The families, in the order a reader meets them.
 *
 * `keeps` says whether a send of this kind leaves a row behind, which is what
 * decides whether the console can show who received one and when. A family
 * that keeps nothing is not a gap in the list; it is a fact about that family,
 * and the console says so rather than leaving it out.
 */
/**
 * A lead as the configurator records one: an address, the trade beside it, and
 * the screen they stopped on. Both messages about a lead are drawn from this
 * one row, so the notice and the follow-up describe the same person.
 */
const LEAD = {
  email: 'lead@example.com',
  trade: 'Pest Control',
  step: 3,
  unsub_token: '00000000-0000-4000-8000-000000000000',
  campaign: { utm_source: 'outreach', utm_medium: 'email', utm_campaign: 'slow-site' },
}

export const FAMILIES = [
  {
    slug: 'outreach-plain-speed',
    label: 'Outreach, plain, the load time',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The plain chain, first letter. A few typed paragraphs on the seconds the page took, with nothing else in the envelope.',
  },
  {
    slug: 'outreach-plain-search',
    label: 'Outreach, plain, the second letter',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The plain chain, three days on, threaded under the first.',
  },
  {
    slug: 'outreach-plain-nearby',
    label: 'Outreach, plain, the third letter',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The plain chain, pointing at a site already live.',
  },
  {
    slug: 'outreach-plain-last',
    label: 'Outreach, plain, the last letter',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The plain chain, answered with a number.',
  },
  {
    slug: 'outreach-intro',
    label: 'Outreach, the introduction',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The introduction chain, first letter. Says nothing about the reader\u2019s own business: who is writing, two sites to look at, and what happens after they say yes.',
  },
  {
    slug: 'outreach-intro-process',
    label: 'Outreach, how a build goes',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The introduction chain, second letter. What a build actually runs like.',
  },
  {
    slug: 'outreach-intro-pointer',
    label: 'Outreach, wrong person',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The introduction chain, third letter. Assumes theirs is sorted and asks to be pointed elsewhere.',
  },
  {
    slug: 'outreach-plain-listing',
    label: 'Outreach, plain, no site of its own',
    system: 'outreach',
    from: 'The address held in outreach settings',
    keeps: true,
    note: 'The plain chain for a business whose listing points at a platform.',
  },
  {
    slug: 'newsletter-client',
    label: 'Newsletter, the client copy',
    system: 'newsletter',
    from: 'TaylorURL <notes@taylorurl.com>',
    keeps: true,
    note: 'For somebody whose site the studio already runs. Carries the blocks written to that side.',
  },
  {
    slug: 'newsletter-prospect',
    label: 'Newsletter, the prospect copy',
    system: 'newsletter',
    from: 'TaylorURL <notes@taylorurl.com>',
    keeps: true,
    note: 'For everybody else on the list. The same issue, minus what only a client is owed.',
  },
  {
    slug: 'enquiry',
    label: 'Enquiry notice',
    system: 'enquiry',
    from: 'TaylorURL Website <website@taylorurl.com>',
    keeps: false,
    note: 'Sent to the studio when somebody fills in a form. Only where it came from is recorded, never what it said.',
  },
  {
    slug: 'speed-check-notice',
    label: 'Speed Check notice',
    system: 'enquiry',
    from: 'TaylorURL Website <website@taylorurl.com>',
    keeps: false,
    note: 'Sent to the studio when somebody leaves an address with a reading. The reading is kept against the check; the notice is not.',
  },
  {
    slug: 'purchase-notice',
    label: 'Purchase notice',
    system: 'purchase',
    from: 'TaylorURL Website <website@taylorurl.com>',
    keeps: false,
    note: 'Sent to the studio when a payment clears and a build opens, on the first delivery of the payment and no other. The project is kept; the notice is not.',
  },
  {
    slug: 'outreach-reply-notice',
    label: 'Outreach reply notice',
    system: 'outreach',
    from: 'TaylorURL Website <website@taylorurl.com>',
    keeps: false,
    note: 'Sent to the studio for every message the reply reader finds in the outreach mailbox, matched to a prospect or not. The reply itself is kept against the prospect.',
  },
  {
    slug: 'lead-notice',
    label: 'New lead notice',
    system: 'enquiry',
    from: 'TaylorURL Website <website@taylorurl.com>',
    keeps: false,
    note: 'Sent to the studio the first time an address is typed into the configurator, and not again for that address. The lead is kept; the notice is not.',
  },
  {
    slug: 'start-followup',
    label: 'Configurator follow-up',
    system: 'enquiry',
    from: 'TaylorURL Website <website@taylorurl.com>',
    keeps: true,
    note: 'Sent a day after somebody started a build and did not finish, once and never twice, carrying a single-use code for half the up-front fee. Recorded against the lead.',
  },
  {
    slug: 'confirmation',
    label: 'Signup confirmation',
    system: 'confirmation',
    from: 'TaylorURL <newsletter@taylorurl.com>',
    keeps: false,
    note: 'Sent by the signup endpoint to the address that has just asked to join the list.',
  },
  {
    slug: 'client-notification',
    label: 'Client project notification',
    system: 'notify',
    from: 'The project\u2019s own name, on notifications@taylorurl.com',
    keeps: true,
    note: 'Sent by a product the studio runs when it has something its owner cannot wait for an open tab to hear. Drawn in that product\u2019s own name, colour and mark, and recorded against the project rather than in the list beside this.',
  },
  {
    slug: 'account',
    label: 'Account mail',
    system: 'account',
    from: 'Held by Supabase',
    keeps: false,
    previewable: false,
    note: 'Sign-up confirmation, password reset and email change. The wording lives in the Supabase project rather than in this repository, so it cannot be drawn here.',
  },
]

/**
 * One family, rendered.
 *
 * A cold message carries its capture behind an open counter keyed on the
 * message's own token, so a sample rendered without one is a sample that never
 * exercises the counter. `track` supplies it, which is what lets the disarming
 * be checked against the shape a stored message actually has.
 *
 * @param {string} slug Which family.
 * @param {{track?: string|null}} [options] The token a real send would carry.
 * @returns {{subject: string, html: string, text: string}|null} The message, or
 *   null for a family whose wording this repository does not hold.
 */
export function renderFamily(slug, { track = null } = {}) {
  // Every cold letter the studio sends, rendered by the same composer that
  // sends it, so a preview is the letter being right rather than a copy of the
  // letter typed out again. The reading the plain letters open on comes off
  // `audit_raw`, which a measured row carries.
  if (PLAIN_SAMPLES[slug]) {
    const { id, row } = PLAIN_SAMPLES[slug]
    const letter = variantById(id)
    const prior = (letter.step ?? 1) > 1 ? { subject: 'example.com load time' } : null
    return compose(row, null, track, letter, { prior })
  }
  if (slug === 'newsletter-client' || slug === 'newsletter-prospect') {
    // One issue is two letters. The side is named outright rather than taken
    // from a sample subscriber, so both are reachable from one sample.
    const drawn = renderIssueEmail({
      issue: ISSUE,
      subscriber: SUBSCRIBER,
      unsubscribeEndpoint: `${SITE}/unsubscribe`,
      audience: slug === 'newsletter-client' ? CLIENT_SIDE : PROSPECT_SIDE,
    })
    return { subject: drawn.subject, html: drawn.html, text: drawn.text }
  }
  if (slug === 'enquiry') {
    return {
      subject: `Website enquiry from ${ENQUIRY.name} (${METHOD_LABELS[ENQUIRY.contactMethod]})`,
      html: htmlBody(ENQUIRY),
      text: textBody(ENQUIRY),
    }
  }
  if (slug === 'speed-check-notice') {
    const { subject, html, text } = speedCheckNotice(SPEED_CHECK)
    return { subject, html, text }
  }
  if (slug === 'purchase-notice') {
    // Read the same way a paid session is read, so the sample is the message
    // being right rather than a copy of it built by hand.
    const purchase = purchaseOf(
      PURCHASE_SESSION,
      openArgs(PURCHASE_SESSION, PROSPECT_MEASURED.email),
      {
        project: 'e4b1c07a-7d5f-4a1e-9f2c-8b60d3a5c114',
        brief: 'attached',
      }
    )
    const { subject, html, text } = purchaseNotice(purchase)
    return { subject, html, text }
  }
  if (slug === 'outreach-reply-notice') {
    const { subject, html, text } = replyNotice(REPLY, {
      name: PROSPECT.name,
      website: PROSPECT.website,
      stage: 'contacted',
    })
    return { subject, html, text }
  }
  if (slug === 'client-notification') {
    // Read the same way a posted one is read, so the sample is the message
    // being right rather than a copy of it built by hand.
    const { notification } = readNotification(CLIENT_NOTIFICATION, CLIENT_PROJECT)
    const drawn = clientNotice(CLIENT_PROJECT, notification)
    return { subject: drawn.subject, html: drawn.html, text: drawn.text }
  }
  if (slug === 'lead-notice') {
    // Drawn by the same builder the endpoint uses, so a preview is the notice
    // being right rather than a copy of it typed out again.
    const drawn = notice({
      label: 'Configurator',
      subject: `${LEAD.email} started a build \u2014 ${LEAD.trade}`,
      rows: [
        ['Address', LEAD.email],
        ['Trade', LEAD.trade],
        ['Reached', 'Step 4 of 5, What it costs'],
        ['Came from', 'outreach / email / slow-site'],
      ],
      replyTo: LEAD.email,
      link: { label: 'Open the leads in the console', url: `${SITE}/console/leads` },
    })
    return { subject: drawn.subject, html: drawn.html, text: drawn.text }
  }
  if (slug === 'start-followup') {
    const drawn = followUpMessage({
      trade: LEAD.trade,
      step: LEAD.step,
      code: 'BUILD50-7QK4TX',
      expires: 'on 12 September',
      startUrl: `${SITE}/start?utm_source=followup&utm_medium=email&utm_campaign=start-followup`,
      unsubscribeUrl: `${SITE}/api/lead-unsubscribe?token=${LEAD.unsub_token}`,
    })
    return { subject: drawn.subject, html: drawn.html, text: drawn.text }
  }
  if (slug === 'confirmation') {
    const drawn = confirmationBodies(
      `${SITE}/subscribe/confirm?token=preview`,
      `${SITE}/unsubscribe?token=preview`
    )
    return { subject: 'Confirm your subscription', html: drawn.html, text: drawn.text }
  }
  return null
}
