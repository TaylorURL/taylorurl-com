/**
 * Proves that a reply to a lead, written from any mailbox, reaches the record.
 *
 * The console's own send button stamped a lead answered as it sent, and a
 * reply written in a mailbox stamped nothing, so a lead answered by hand sat
 * under Waiting until somebody remembered to say otherwise. The notice about
 * a lead now carries the site's own address on Reply-To and api/lead-reply.js
 * files what arrives there before passing it on. This holds the address to a
 * shape the endpoint can read back, holds the endpoint to filing before it
 * sends and to taking replies from the studio alone, and holds every door
 * that notices a lead to carrying the address.
 *
 *   npm run check:lead-reply
 */

import {
  RELAY_DOMAIN,
  RELAY_SENDER,
  forwardFrom,
  leadIdFrom,
  relayAddress,
  replyAddressFor,
  senderNameFrom,
} from '../../lib/leads/relay.js'
import { signedByResend } from '../../lib/mail/webhook.js'
import { createHmac } from 'node:crypto'
import { cases, check, finish, ok, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const ENDPOINT = 'api/lead-reply.js'
const ID = '77504506-2007-4edd-9fea-47b286a6b823'

check('a lead gets an address under its own name', () => {
  same(
    relayAddress({ id: ID, name: 'Felipe' }),
    `"Felipe" <lead.${ID}@${RELAY_DOMAIN}>`,
    'the address'
  )
  same(relayAddress({ id: ID }), `lead.${ID}@${RELAY_DOMAIN}`, 'with no name to show')
})

check('a name cannot close the quotes, open a bracket or start a header', () => {
  const address = relayAddress({ id: ID, name: 'Felipe" <felipe@example.org>\r\nBcc: x' })
  ok(!address.includes('\n'), 'a line end survived')
  ok(address.indexOf('<') === address.lastIndexOf('<'), 'a second bracket survived')
  same(address.split('"').length, 3, 'exactly one quoted name')
})

check('what is not a lead gets no address', () => {
  same(relayAddress({ id: 'not-an-id', name: 'x' }), null, 'a bad id')
  same(relayAddress(null), null, 'nothing')
  same(relayAddress({ fresh: true }), null, 'a row that was not written')
})

check('a notice falls back to the sender where the row was not written', () => {
  same(replyAddressFor(null, 'Felipe@Example.org'), 'felipe@example.org', 'their own address')
  same(replyAddressFor({ id: ID }, 'felipe@example.org'), `lead.${ID}@${RELAY_DOMAIN}`, 'the relay')
  same(replyAddressFor(null, ''), undefined, 'no address at all')
})

check('the endpoint reads the lead back off the address, on any recipient line', () => {
  same(leadIdFrom([`LEAD.${ID.toUpperCase()}@${RELAY_DOMAIN}`]), ID, 'whatever the case')
  same(
    leadIdFrom(['dj@taylorurl.com', `lead.${ID}@${RELAY_DOMAIN}`]),
    ID,
    'behind another recipient'
  )
  same(leadIdFrom([`lead.${ID}@taylorurl.com`]), null, 'on the wrong domain')
  same(leadIdFrom([`other.${ID}@${RELAY_DOMAIN}`]), null, 'under another prefix')
  same(leadIdFrom([`lead.nope@${RELAY_DOMAIN}`]), null, 'with no id')
  same(leadIdFrom(null), null, 'with nothing')
})

check('the name on the From line is read from either shape Resend hands over', () => {
  same(
    senderNameFrom([{ name: 'From', value: '"Trenton Taylor" <trenton@taylorurl.com>' }]),
    'Trenton Taylor',
    'as a list'
  )
  same(
    senderNameFrom({ from: 'Trenton Taylor <trenton@taylorurl.com>' }),
    'Trenton Taylor',
    'keyed, unquoted'
  )
  same(senderNameFrom({ from: '<trenton@taylorurl.com>' }), null, 'with no name')
  same(senderNameFrom(undefined), null, 'with no headers')
})

check("a reply leaves under the writer's own address where Resend can sign it", () => {
  same(
    forwardFrom('trenton@taylorurl.com', 'Trenton Taylor'),
    '"Trenton Taylor" <trenton@taylorurl.com>',
    'from the studio domain'
  )
  same(
    forwardFrom('trenton@baytownwebdevelopment.com', 'Trenton Taylor'),
    `"Trenton Taylor" <${RELAY_SENDER}>`,
    'from a domain Resend cannot sign'
  )
  same(forwardFrom('dj@taylorurl.com', null), '"dj" <dj@taylorurl.com>', 'with no name on the line')
})

check('a delivery is taken only under its own signature', () => {
  const secret = `whsec_${Buffer.from('a secret for the test').toString('base64')}`
  const body = '{"type":"email.received"}'
  const headers = { 'svix-id': 'msg_1', 'svix-timestamp': '1700000000' }
  const sign = key =>
    `v1,${createHmac('sha256', Buffer.from(key.replace(/^whsec_/, ''), 'base64'))
      .update(`${headers['svix-id']}.${headers['svix-timestamp']}.${body}`)
      .digest('base64')}`
  same(signedByResend({ ...headers, 'svix-signature': sign(secret) }, body, secret), true, 'signed')
  same(
    signedByResend({ ...headers, 'svix-signature': sign(secret) }, body + ' ', secret),
    false,
    'a body that moved'
  )
  same(
    signedByResend({ ...headers, 'svix-signature': sign('whsec_b3RoZXI=') }, body, secret),
    false,
    'another secret'
  )
  same(
    signedByResend({ ...headers, 'svix-signature': sign(secret) }, body, ''),
    false,
    'no secret set'
  )
  same(signedByResend(headers, body, secret), false, 'no signature')
})

check('the endpoint claims the record before it touches the transport', () => {
  const source = read(ENDPOINT)
  const claim = source.indexOf('.from(MESSAGES)\n      .insert(')
  const send = source.indexOf("'/emails',")
  ok(claim > 0 && send > 0 && claim < send, 'the send comes before the claim')
  ok(source.includes("delete().eq('id', claim.id)"), 'a failed send does not take the claim back')
  ok(source.includes("eq('provider_id', messageId)"), 'a repeat delivery is not recognised')
  ok(source.includes('status(502)'), 'a failed send does not ask Resend to try again')
})

check('the endpoint passes on replies from the studio alone', () => {
  const source = read(ENDPOINT)
  ok(source.includes('ownAddress(sender)'), 'a stranger writing to a relay address is passed on')
  ok(source.includes("event?.type !== 'email.received'"), 'another event is acted on')
  ok(source.includes('bodyParser: false'), 'the body is parsed before it is checked')
  ok(
    source.includes('signedByResend(request.headers, body, SIGNING_SECRET)'),
    'the signature is not read'
  )
})

check('the endpoint stamps the lead once, at the time the reply was written', () => {
  const source = read(ENDPOINT)
  ok(source.includes(".is('contacted_at', null)"), 'a lead already answered is moved')
  ok(source.includes('contacted_at: at'), 'the stamp is not the time of the reply')
  ok(!/\bdue_at\s*:/.test(source), 'the promised date is touched')
})

for (const [door, file] of [
  ['contact', 'api/contact.js'],
  ['ad', 'api/ad-lead.js'],
  ['speed check', 'api/speed-check.js'],
]) {
  check(`the ${door} notice carries the relay address`, () => {
    const source = read(file)
    ok(source.includes('replyAddressFor('), `${file} does not call replyAddressFor`)
    const lead = source.indexOf('keepLead(')
    const reply = source.indexOf('replyAddressFor({ id: lead?.id')
    ok(lead > 0 && reply > 0, `${file} does not hand the lead to the address`)
  })
}

check('the contact form writes the lead before the notice goes', () => {
  const source = read('api/contact.js')
  const lead = source.indexOf('const lead = await keepLead(')
  const sent = source.indexOf('await deliver(enquiry, key, lead)')
  ok(lead > 0 && sent > lead, 'the notice goes before the row exists to name')
})

check('the deployment is told what the endpoint reads', () => {
  const example = read('.env.example')
  for (const name of ['LEAD_REPLY_WEBHOOK_SECRET', 'LEAD_REPLY_DOMAIN']) {
    ok(example.includes(`${name}=`), `.env.example does not name ${name}`)
  }
})

await finish()

console.log(`lead reply: all ${cases.length} cases pass`)
