/**
 * Proves that finishing a sign-in never changes what is on screen.
 *
 * The page transition fades away whatever the outgoing route last drew. A
 * screen chosen again in the render that finds the sign-in finished is
 * therefore the screen that gets faded, which is how the sign-in form appears
 * for a moment on the way to the console after a code has already been
 * accepted. Drawing nothing in its place fades an empty frame instead, which
 * looks like the page falling out rather than leaving.
 *
 * The walks below are the ones a real sign-in takes, in order, and the check
 * each time is the same: once leaving, the screen holds.
 *
 * The screen after a payment is the same fault seen from the other side. It
 * signs a buyer in without being asked to, which hands it an account a frame or
 * two before the page has finished reading that account back - and a rule that
 * reads that gap as an ending draws the screen offering a password to somebody
 * who is already signed in and on their way to the console.
 */

import { nextScreen, welcomeScreen } from '../../src/app/views/auth/lib/screen.js'

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`)
}

/** Run a sequence of states through the rule, collecting what each draws. */
function walk(states, start = 'password') {
  let screen = start
  return states.map(state => {
    screen = nextScreen(screen, state)
    return screen
  })
}

const SIGNED_OUT = { leaving: false, waiting: false, pending: false }
const SETTLING = { leaving: false, waiting: false, pending: false }
const OWES_CODE = { leaving: false, waiting: false, pending: true }
const DONE = { leaving: true, waiting: false, pending: false }
const READING = { leaving: false, waiting: true, pending: false }

check('a signed-out visitor meets the form', () => {
  same(nextScreen('password', SIGNED_OUT), 'password', 'screen')
})

check('an account owing a code is asked for one', () => {
  same(nextScreen('password', OWES_CODE), 'code', 'screen')
})

check('an account still being read back waits', () => {
  same(nextScreen('password', READING), 'wait', 'screen')
})

check('a code accepted leaves on the code screen', () => {
  // The whole two-factor sign-in. The last step is the one that matters: the
  // screen that fades away has to be the code screen, not the form behind it.
  const drawn = walk([SIGNED_OUT, SETTLING, OWES_CODE, DONE])
  same(drawn.join(' '), 'password password code code', 'the screens drawn')
})

check('a sign-in with no factor leaves on the form', () => {
  const drawn = walk([SIGNED_OUT, SETTLING, DONE])
  same(drawn.join(' '), 'password password password', 'the screens drawn')
})

check('arriving already signed in leaves on the placeholder', () => {
  // Nothing has been drawn to keep, so the wait is what leaves. Falling back to
  // the form here would show a sign-in screen to somebody already signed in.
  const drawn = walk([READING, DONE])
  same(drawn.join(' '), 'wait wait', 'the screens drawn')
})

check('leaving holds every screen, whatever else changes under it', () => {
  // Once leaving, the answers behind the screen are free to settle differently
  // and none of them may move it.
  for (const start of ['wait', 'code', 'password']) {
    for (const waiting of [true, false]) {
      for (const pending of [true, false]) {
        same(nextScreen(start, { leaving: true, waiting, pending }), start, `held from ${start}`)
      }
    }
  }
})

check('leaving never draws nothing', () => {
  const drawn = walk([OWES_CODE, DONE])
  same(Boolean(drawn[1]), true, 'a screen is drawn on the way out')
})

/* ----------------------------------------------------------------------- *
 * The screen after a payment.
 * ----------------------------------------------------------------------- */

const CLAIMING = { settled: false, signedIn: false, leaving: false }
const REDEEMED = { settled: false, signedIn: true, leaving: false }
const READING_BACK = { settled: true, signedIn: true, leaving: false }
const IN_HAND = { settled: true, signedIn: true, leaving: true }
const NO_WAY_IN = { settled: true, signedIn: false, leaving: false }

check('a buyer waits while the key is being spent', () => {
  same(welcomeScreen(CLAIMING), 'wait', 'screen')
})

check('a buyer signed in waits rather than being offered a password', () => {
  // The whole arrival, in the order it happens. The two middle steps are the
  // gap: the sign-in has landed and the account has not been read back yet.
  const drawn = [CLAIMING, REDEEMED, READING_BACK, IN_HAND].map(welcomeScreen)
  same(drawn.join(' '), 'wait wait wait wait', 'the screens drawn')
})

check('a key that opened nothing is what reaches the second screen', () => {
  same(welcomeScreen(NO_WAY_IN), 'password', 'screen')
})

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
    console.log(`  ok  ${name}`)
  } catch (cause) {
    failed += 1
    console.error(`FAIL  ${name}\n      ${cause.message}`)
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
