/**
 * The clock and the mail server the send checks run the route against.
 *
 * The sending window opens at eight and closes at five in Texas, and a run
 * outside it composes without delivering, so a check of what happens after the
 * transport would turn on the hour it was run at. Every send case is run at an
 * afternoon inside the window instead, held for the length of one case.
 *
 * The transport answers like a mail server and reaches no network. The route
 * builds its transport once per process and holds it, so this one is installed
 * as this module loads and read between cases rather than swapped in around
 * each of them. Installing it before the first case is also what guarantees no
 * case can open a socket.
 */
import nodemailer from 'nodemailer'

/** The instant every send case is run at, and the one the address is settled at. */
export const AFTERNOON = new Date('2026-08-29T18:00:00.000Z').getTime()

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
