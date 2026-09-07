/**
 * Proves the screen a buyer meets straight off a payment has no way out of it.
 *
 * That screen is the shared sign-up form, and everything a cold reader is owed
 * on it becomes a hazard for somebody who has already paid: a wordmark that
 * links home, a way back to the site sitting above the form, a panel arguing
 * the case for an account they have already bought, and a way to the login
 * screen that throws away the one string knowing which purchase they are in
 * the middle of claiming. None of those is a bug for the reader they were
 * written for. All four are doors out of a purchase that is not finished, and
 * a buyer who takes one has paid and holds nothing.
 *
 * The failure is silent from every direction. The payment succeeded, the
 * project exists, the console is waiting, and the only sign anything went
 * wrong is a build sitting unclaimed under an address while its buyer wonders
 * what they bought. So the branch is read here rather than trusted.
 *
 *   npm run check:buyer-path
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const read = path => readFileSync(join(ROOT, path), 'utf8')

const SIGNUP = 'src/app/views/auth/Signup.jsx'
const LOGIN = 'src/app/views/auth/Login.jsx'
const SHELL = 'src/app/views/auth/AuthShell.jsx'
const NEXT = 'src/app/views/auth/AuthNext.jsx'
const READER = 'src/app/data/checkout/checkoutSession.js'

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`)
}

check('the sign-up screen tells the shell which arrival it is', () => {
  const signup = read(SIGNUP)
  same(/bought=\{bought\}/.test(signup), true, 'the arrival is passed down')
  same(/business=\{business\}/.test(signup), true, 'the business is passed down')
})

check('a buyer is offered no way back to the site', () => {
  const shell = read(SHELL)
  // The leave link is the explicit one, sitting directly above the form.
  same(
    /\{!bought && \(\s*<Link to="\/" className="auth-leave">/.test(shell),
    true,
    'the way out is drawn only for a reader who has not paid'
  )
  // And the wordmark is the one somebody clicks without reading it.
  same(
    /bought \? \(\s*<span className="auth-back">/.test(shell),
    true,
    'the wordmark is a mark rather than a door for a buyer'
  )
})

check('a buyer is not sold what they hold a receipt for', () => {
  const shell = read(SHELL)
  same(
    shell.includes('{bought ? <AuthNext business={business} /> : <AuthCase />}'),
    true,
    'the panel says what happens next rather than why to sign up'
  )

  // The case panel is what argues for an account, and it must not be what a
  // buyer is looking at.
  const next = read(NEXT)
  for (const sold of ['Live Readers', 'Traffic', 'Sources', 'Page Speed', 'Uptime']) {
    same(next.includes(sold), false, `the buyer panel does not pitch ${sold}`)
  }
})

check('the panel names the three things the tracker opens by asking for', () => {
  // Seeded against every project as it is created, in `project_seed_tasks`.
  // Naming them here means the screen before the console and the screen after
  // it agree, and a buyer can go and find their logo while it loads.
  const next = read(NEXT)
  for (const ask of ['logo', 'words', 'photographs']) {
    same(next.toLowerCase().includes(ask), true, `the panel names ${ask}`)
  }
})

check('the way to the login screen carries the checkout with it', () => {
  const signup = read(SIGNUP)
  same(
    signup.includes('/login?bought=1&session_id=${encodeURIComponent(session_id)}'),
    true,
    'a buyer who taps through to login keeps the purchase'
  )
  same(signup.includes('alternative={{ to: loginHref'), true, 'both screens use it')
  // Twice: the form, and the screen saying an email is on its way.
  same(signup.split('loginHref').length - 1 >= 3, true, 'every way to login carries it')
})

check('and the login screen hands it back', () => {
  const login = read(LOGIN)
  same(
    login.includes('/signup?bought=1&session_id=${encodeURIComponent(session_id)}'),
    true,
    'the round trip closes rather than stranding them one screen along'
  )
  same(login.includes('alternative={{ to: signupHref'), true, 'the way back uses it')
})

check('what the checkout knows is filled in rather than asked for again', () => {
  const signup = read(SIGNUP)
  same(signup.includes('setFullName(found.name)'), true, 'the name is filled from the payment')
  same(signup.includes('setEmail(found.email)'), true, 'the address is filled from the payment')
  same(signup.includes('setBusiness(found.business)'), true, 'the business is read back')

  // Each field stands down on its own. One shared flag means correcting the
  // name freezes the address at whatever the lookup had reached.
  same(signup.includes('touchedName'), true, 'the name stands down when typed into')
  same(signup.includes('touchedEmail'), true, 'the address stands down separately')

  // A filled name must not also be focused, or the first keystroke of somebody
  // tabbing through lands on top of it.
  same(signup.includes('autoFocus={!fullName}'), true, 'focus goes to what is still empty')
})

check('a lookup that fails costs a buyer nothing', () => {
  const reader = read(READER)
  same(reader.includes('return null'), true, 'every failure answers null')
  same(reader.includes('catch {'), true, 'nothing thrown reaches the screen')
  // The fields stay empty and get typed into, which is what would have
  // happened anyway. What must never happen is an error about our plumbing in
  // front of somebody who has just paid.
  same(/\bthrow new\b/.test(reader), false, 'the reader raises nothing of its own')
})

const failures = []
for (const [name, run] of cases) {
  try {
    run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const line of failures) console.error(line)
  console.error(`buyer path: ${failures.length} of ${cases.length} cases failed`)
  process.exit(1)
}

console.log(`buyer path: all ${cases.length} cases pass; the screen after a payment has no way out`)
