/**
 * Holds the copies of the day's mail to the letters the businesses got, with
 * nothing in them that reports back.
 *
 * A copy goes to the studio's own inbox from the address the letter left from,
 * under its subject and in its body. What it must not keep is the open square,
 * the tracking token its links carry, or the unsubscribe token, since any of
 * the three would let the studio reading its own copy pass for the business.
 * The cases are the three letters that went: a preview letter, a lawsuit
 * letter, and a new-business letter whose HTML is written again from its lead.
 *
 *   node scripts/outreach/sending/check-copies.js
 */
import '../send-fixture.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { check, finish, ok, same } from '../../harness/checks.js'
import { INERT, copyOf, newBusinessCopyOf, work } from '../../../api/outreach/copies.js'
import { composeFor } from '../../../lib/new-business/email.js'

installFixtureHeldDomains()

const TRACK = '945c370a-dd19-460e-be2b-43d22548d68d'
const UNSUB = 'edc4380d-a697-4860-8725-487112d8c945'

const preview = {
  subject: 'Trenton Taylor - TaylorURL',
  body_text: 'Hi Sam,\n\nhttps://sampleworks.taylorurl.com\n',
  body_html:
    '<p>Hi Sam,</p>\n<p><a href="https://sampleworks.taylorurl.com">sampleworks.taylorurl.com</a></p>\n' +
    `<img src="https://lonestarsite.com/api/outreach/open?t=${TRACK}" alt="" width="1" height="1">\n</body>`,
}

const lawsuit = {
  subject: 'Trenton Taylor, TaylorURL',
  body_text: `Hi,\n\nUnsubscribe: https://gettaylorurl.com/api/outreach/unsubscribe?token=${UNSUB}`,
  body_html:
    `<a href="https://www.taylorurl.com/?utm_content=${TRACK}">sig</a>` +
    `<a href="https://gettaylorurl.com/api/outreach/unsubscribe?token=${UNSUB}">Unsubscribe</a>\n` +
    `<img src="https://gettaylorurl.com/api/outreach/open?t=${TRACK}" alt="">\n`,
}

check('a preview copy keeps its subject, its words and its preview link', () => {
  const copy = copyOf(preview, [TRACK, null])
  same(copy.subject, preview.subject, 'subject')
  same(copy.text, preview.body_text, 'plain half')
  ok(copy.html.includes('href="https://sampleworks.taylorurl.com"'), 'the preview link is kept')
})

check('a copy carries no open square', () => {
  const copy = copyOf(preview, [TRACK, null])
  ok(!copy.html.includes('/api/outreach/open'), 'the open square is gone')
  ok(copy.html.endsWith('</body>'), 'what follows the square is kept')
})

check('a copy carries neither the tracking token nor the unsubscribe token', () => {
  const copy = copyOf(lawsuit, [TRACK, UNSUB])
  for (const half of [copy.text, copy.html]) {
    ok(!half.includes(TRACK) && !half.includes(UNSUB), 'no token is left')
  }
  ok(copy.html.includes(`utm_content=${INERT}`), 'the link still goes, under the inert tag')
  ok(copy.text.includes(`unsubscribe?token=${INERT}`), 'the unsubscribe link reaches no row')
})

const lead = {
  id: 'lead-1',
  name: 'SAMPLE WORKS LLC',
  formed_on: '2026-10-02',
  website: 'https://sampleworks.example.com',
  email: 'hello@sampleworks.example.com',
  unsub_token: '49a17073-557d-49ab-a59e-716971d59487',
}
const sentAt = '2026-10-26T13:03:32.275Z'
const went = composeFor(lead, new Date(sentAt))

check('a new-business copy is written again, as it went, with the token made inert', () => {
  const row = { subject: went.subject, body_text: went.body_text, sent_at: sentAt }
  const copy = newBusinessCopyOf(row, lead)
  same(copy.text, went.body_text.split(lead.unsub_token).join(INERT), 'plain half')
  same(copy.html, went.body_html.split(lead.unsub_token).join(INERT), 'HTML half')
})

check('a new-business letter that would not come out the same goes as its plain half', () => {
  const row = { subject: went.subject, body_text: `${went.body_text}\nedited`, sent_at: sentAt }
  const copy = newBusinessCopyOf(row, lead)
  same(copy.html, undefined, 'no HTML the business never saw')
  ok(!copy.text.includes(lead.unsub_token), 'the token is still made inert')
})

check(
  'the run sends each letter to the studio, from its own address, in the order it went',
  async () => {
    const sent = []
    const table = rows => ({
      select: () => table(rows),
      eq: () => table(rows),
      gte: () => table(rows),
      order: () => table(rows),
      range: () => Promise.resolve({ data: rows, error: null, count: rows.length }),
      then: (resolve, reject) =>
        Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject),
    })
    const outreach = [
      {
        id: 'm1',
        ...preview,
        from_address: 'studio@example.com',
        to_address: 'sam@example.com',
        track_token: TRACK,
        variant_id: null,
        sent_at: '2026-10-26T13:18:24.578Z',
        outreach_prospects: { unsub_token: UNSUB },
      },
    ]
    const nb = [
      {
        id: 'n1',
        subject: went.subject,
        body_text: went.body_text,
        to_address: lead.email,
        sent_at: sentAt,
        new_business_leads: lead,
      },
    ]
    const db = {
      from: name =>
        table(name === 'outreach_messages' ? outreach : name === 'new_business_messages' ? nb : []),
    }
    const settings = { from_address: 'studio@example.com', from_name: 'Trenton Taylor' }
    const counts = { examined: 0, changed: 0 }
    const answer = await work({ db, settings, counts }, async message => {
      sent.push(message)
      return 'id'
    })
    same(`${counts.examined}/${counts.changed}`, '2/2', 'examined/changed')
    same(answer.error, undefined, 'no letter missed')
    same(
      JSON.stringify(sent.map(one => [one.to, one.from.address, one.subject])),
      JSON.stringify([
        ['trenton@taylorurl.com', 'studio@example.com', went.subject],
        ['trenton@taylorurl.com', 'studio@example.com', preview.subject],
      ]),
      'what went where'
    )
    same(sent[1].from.name, 'Trenton Taylor', 'a preview copy goes under the preview name')
  }
)

finish({ hint: 'api/outreach/copies.js' })
