/**
 * The configuration held across a reload.
 *
 * The configurator asks five questions before it asks for a card, and all five
 * answers live in component state. A reload, a mistaken back gesture, or a tab
 * the phone dropped to reclaim memory took every one of them and put the
 * visitor back on the first question with nothing to show for the five minutes
 * they had spent. The step is the most expensive screen on the site to have to
 * fill in twice.
 *
 * So the picked configuration is written down as it is made and read back on
 * the next mount. Session storage rather than local: the answers belong to the
 * visit that made them, and a browser shared in a shop should not open on
 * somebody else's brief a week later.
 *
 * What is typed into the payment form - the business the card is being used
 * for, the site it replaces - is never written here. It is personal data that
 * the visitor has not chosen to leave anywhere, and it is a screen they are
 * already standing on rather than four screens behind them.
 *
 * The address given on the first step is the exception, and it is not really
 * one: it is an answer to a step rather than a line on a payment form, and the
 * step it answers is the gate the other four stand behind. Left out, a reload
 * would restore every answer and then hold them all shut behind an empty field,
 * which is the restore doing nothing at all.
 */

import { browserStore } from '@utils/storage'

/** Where the held configuration lives. */
const KEY = 'tu_start'

const strings = value =>
  Array.isArray(value) ? value.filter(item => typeof item === 'string') : []

const text = value => (typeof value === 'string' ? value : null)

/**
 * The configuration a visit left behind, or null where there is none.
 *
 * Every field is read back through its own shape rather than trusted, because
 * what comes out of the store is whatever version of this page last wrote it.
 * A half-understood entry restores as nothing, which costs the visitor the
 * answers they would have lost anyway.
 */
export function recalledStart() {
  const held = browserStore('sessionStorage')
  if (!held) return null

  try {
    const raw = JSON.parse(held.getItem(KEY) || 'null')
    if (!raw || typeof raw !== 'object') return null

    const look = raw.look && typeof raw.look === 'object' ? raw.look : {}

    return {
      tradeId: text(raw.tradeId),
      // The field it goes back into is a controlled input, so it has to come
      // back as a string. Null would hand React an uncontrolled field.
      email: typeof raw.email === 'string' ? raw.email : '',
      designs: strings(raw.designs),
      chosenTools: strings(raw.chosenTools),
      provider: text(raw.provider),
      look: {
        feels: strings(look.feels),
        brand: text(look.brand),
        photos: text(look.photos),
        voice: text(look.voice),
        notes: typeof look.notes === 'string' ? look.notes : '',
      },
      step: Number.isInteger(raw.step) && raw.step >= 0 ? raw.step : 0,
    }
  } catch {
    // A refused read and a half-written entry come to the same thing: the
    // configurator opens on its first question, which is where it opens for
    // somebody arriving for the first time.
    return null
  }
}

/** Records the configuration as it stands. */
export function rememberStart(configuration) {
  const held = browserStore('sessionStorage')
  if (!held) return

  try {
    held.setItem(KEY, JSON.stringify(configuration))
  } catch {
    // A full or refused store costs the restore and nothing else.
  }
}
