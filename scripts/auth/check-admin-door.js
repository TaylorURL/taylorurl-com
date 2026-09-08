/**
 * Proves the admin door refuses exactly what it always refused, while asking
 * its two questions at once.
 *
 * The door is two remote reads: verify the session, then read the role off the
 * profile row. Run in that order they add up, and the sum sits on the front of
 * every authenticated request the console makes - every page, and every beat
 * behind them - which is latency nobody can see in a query plan because
 * neither read is slow on its own.
 *
 * They go out together instead. The role read is aimed by the `sub` the token
 * writes about itself, which is a guess: a JWT is a string anybody can compose,
 * and until the verifier answers, nothing in it is known. So the guess is only
 * ever a head start on which row to fetch, and the row is thrown away unless
 * the account that verified is the account it was read for. What that buys an
 * attacker is one wasted read of a row they are never shown; what it costs a
 * signed-in employee is one round trip off every request they make.
 *
 * Everything below is that trade held to: the refusals are unchanged, and the
 * reads overlap.
 */

import { authorizeAdmin } from '../../lib/db/clients.js'

const ADMIN = 'account-admin'
const CLIENT = 'account-client'

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`)
}

/** A token that states an account, signed by nobody. */
function token(sub) {
  const part = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `Bearer ${part({ alg: 'HS256' })}.${part({ sub })}.not-a-signature`
}

/**
 * A stand-in for the two clients, recording what was asked and in what order.
 *
 * `roles` is who the database holds; `verifies` is who the verifier will
 * actually vouch for, which is the whole of the difference between a token
 * that says something and a token that is true. `held` keeps the verifier
 * unanswered until it is released, so a read issued while it is outstanding
 * proves the two went out together rather than one after the other.
 */
function door({ roles = {}, verifies = null, held = false } = {}) {
  const read = []
  let release = () => {}
  const waiting = new Promise(resolve => {
    release = resolve
  })
  const clients = {
    verifier: {
      auth: {
        async getUser() {
          if (held) await waiting
          if (!verifies) return { data: null, error: new Error('no session') }
          return {
            data: { user: { id: verifies, email: `${verifies}@taylorurl.com` } },
            error: null,
          }
        },
      },
    },
    db: {
      from() {
        const answer = { id: null }
        const builder = {
          select: () => builder,
          eq(_column, value) {
            answer.id = value
            read.push(value)
            return builder
          },
          maybeSingle: () => builder,
          then(resolve) {
            const role = roles[answer.id]
            if (role instanceof Error) return resolve({ data: null, error: role })
            return resolve({ data: role ? { role } : null, error: null })
          },
        }
        return builder
      },
    },
  }
  return { clients, read, release }
}

check('an admin is let through, and both reads went out before either answered', async () => {
  const { clients, read, release } = door({
    roles: { [ADMIN]: 'admin' },
    verifies: ADMIN,
    held: true,
  })
  const asking = authorizeAdmin(clients, token(ADMIN))
  await Promise.resolve()
  same(read.length, 1, 'the role read is out while the session is still unverified')
  release()
  const account = await asking
  same(account.userId, ADMIN, 'let through')
  same(account.status, undefined, 'no refusal')
  same(read.length, 1, 'the row read on the guess is the row used')
})

check('a token that merely names an admin is refused', async () => {
  // The forged token states the admin's own id, so the guess aims the read at
  // a row that really does say admin. Nothing verifies, so nothing is shown.
  const { clients } = door({ roles: { [ADMIN]: 'admin' }, verifies: null })
  const answer = await authorizeAdmin(clients, token(ADMIN))
  same(answer.status, 401, 'refused')
  same(answer.userId, undefined, 'no account handed back')
})

check('a role read for somebody else is thrown away rather than counted', async () => {
  // The token says one account and the session turns out to be another. The
  // row already read answers a question about the wrong person, so the door
  // reads again for the account that actually verified.
  const { clients, read } = door({
    roles: { [ADMIN]: 'admin', [CLIENT]: 'client' },
    verifies: CLIENT,
  })
  const answer = await authorizeAdmin(clients, token(ADMIN))
  same(answer.status, 403, 'refused as a client')
  same(read.join(','), `${ADMIN},${CLIENT}`, 'read again for whoever verified')
})

check('an account holding no admin role is refused', async () => {
  const { clients } = door({ roles: { [CLIENT]: 'client' }, verifies: CLIENT })
  same((await authorizeAdmin(clients, token(CLIENT))).status, 403, 'refused')
})

check('an account with no profile row at all sees nothing', async () => {
  const { clients } = door({ roles: {}, verifies: CLIENT })
  same((await authorizeAdmin(clients, token(CLIENT))).status, 403, 'refused')
})

check('a role that would not read is never a yes', async () => {
  const { clients } = door({ roles: { [ADMIN]: new Error('policy') }, verifies: ADMIN })
  same((await authorizeAdmin(clients, token(ADMIN))).status, 500, 'unknown is not admin')
})

check('a token stating nothing readable still gets its role read', async () => {
  // No `sub` to aim at, so there is no head start to take and the door falls
  // back to the order it always ran in. It must still let the admin through.
  const { clients, read } = door({ roles: { [ADMIN]: 'admin' }, verifies: ADMIN })
  const account = await authorizeAdmin(clients, 'Bearer not-a-jwt')
  same(account.userId, ADMIN, 'let through')
  same(read.join(','), ADMIN, 'read once, after verifying')
})

check('a request carrying no session touches the database at all', async () => {
  const { clients, read } = door({ roles: { [ADMIN]: 'admin' }, verifies: ADMIN })
  same((await authorizeAdmin(clients, '')).status, 401, 'refused')
  same(read.length, 0, 'nothing read for a request with no token')
})

let failed = 0
for (const [name, run] of cases) {
  try {
    await run()
    console.log(`  ok  ${name}`)
  } catch (cause) {
    failed += 1
    console.error(`FAIL  ${name}\n      ${cause.message}`)
  }
}
console.log(`\nadmin door: ${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
