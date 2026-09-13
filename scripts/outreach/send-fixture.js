/**
 * The clock, the mail login, the mail server and the address check the send
 * checks run the route against.
 *
 * The route reads its mail login, and the switch that arms sending, once as it
 * loads. Without the switch a run composes and delivers nothing, and without the
 * login an armed run refuses, so both are set as this module loads - which is
 * before any check that imports it has loaded the route. Neither reaches a real
 * mailbox: the transport below is the only mail server the route is handed.
 *
 * The sending window opens at eight and closes at five in Texas, and a run
 * outside it composes without delivering, so a check of what happens after the
 * transport would turn on the hour it was run at. Every send case is run at an
 * afternoon inside the window instead, held for the length of one case.
 *
 * A send asks whether its address reaches a mailbox before it hands anything
 * over, and asked for real that is a DNS lookup. So the address a case writes
 * to is settled at that afternoon first, against a resolver that answers from
 * here, and the send reads the verdict already held.
 *
 * The transport answers like a mail server and reaches no network. The route
 * builds its transport once per process and holds it, so this one is installed
 * as this module loads and read between cases rather than swapped in around
 * each of them. Installing it before the first case is also what guarantees no
 * case can open a socket.
 */
import nodemailer from 'nodemailer'
import { checkAddress } from '../../lib/outreach/prospects/address.js'

process.env.OUTREACH_SMTP_USER = 'studio@example.com'
process.env.OUTREACH_SMTP_PASSWORD = 'not-a-password'
process.env.OUTREACH_SEND_ARMED = 'true'

/** The instant every send case is run at, and the one the address is settled at. */
export const AFTERNOON = new Date('2026-08-29T18:00:00.000Z').getTime()

/** Settles the address check for `email` at `AFTERNOON`, as a domain with a mail server. */
export const settleAddress = email =>
  checkAddress(null, email, {
    now: AFTERNOON,
    resolveMx: async () => [{ exchange: 'mx.example.com', priority: 10 }],
  })

/** Runs `run` with the clock held at `AFTERNOON`. */
export async function atMidAfternoon(run) {
  const Real = Date
  class Frozen extends Real {
    constructor(...args) {
      return args.length ? new Real(...args) : new Real(AFTERNOON)
    }
    static now() {
      return AFTERNOON
    }
  }
  globalThis.Date = Frozen
  try {
    return await run()
  } finally {
    globalThis.Date = Real
  }
}

/** Every message the transport was handed, and a way to empty the list between cases. */
export const TRANSPORT = (() => {
  const sent = []
  nodemailer.createTransport = () => ({
    sendMail: async message => {
      sent.push(message)
      return { messageId: '<delivered-1@example.com>' }
    },
  })
  return { sent, clear: () => sent.splice(0, sent.length) }
})()
