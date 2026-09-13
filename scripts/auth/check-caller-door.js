/**
 * Proves a representative reaches the call list and nothing else.
 *
 * The `staff` role existed in the profiles table and in the console's role
 * picker for weeks before anything read it, which means it was a label rather
 * than a permission: every admin endpoint refused it exactly as it refused a
 * client, so an account set to Staff could sign in and see nothing. Two
 * endpoints now admit it - `api/calls-desk.js` and `api/calls-admin.js` - and
 * those two are the whole of the job the role describes.
 *
 * The risk in widening a door is not the door that was widened. It is the six
 * beside it that were written against the same helper and must not move, and
 * that is asserted here rather than read off the diff.
 *
 *   node scripts/auth/check-caller-door.js
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { authorizeAdmin, authorizeCaller } from '../../lib/db/clients.js'
import { cases, check, finish, same } from '../harness/checks.js'
import { filesUnder } from '../harness/files.js'
import { token } from './token-fixture.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const ADMIN = 'account-admin'
const STAFF = 'account-staff'
const CLIENT = 'account-client'

/** The two endpoints a representative is meant to reach, and nothing else. */
const CALLER_DOORS = ['api/calls-desk.js', 'api/calls-admin.js']

/** A stand-in for the two clients, holding whichever roles a case needs. */
function door({ roles = {}, verifies = null } = {}) {
  return {
    verifier: {
      auth: {
        getUser: async () =>
          verifies
            ? { data: { user: { id: verifies, email: `${verifies}@taylorurl.com` } }, error: null }
            : { data: { user: null }, error: new Error('no session') },
      },
    },
    db: {
      from: () => ({
        select: () => ({
          eq: (_column, id) => ({
            maybeSingle: async () => {
              const held = roles[id]
              if (held instanceof Error) return { data: null, error: held }
              return { data: held ? { role: held } : null, error: null }
            },
          }),
        }),
      }),
    },
  }
}

check('a representative is let through the caller door', async () => {
  const account = await authorizeCaller(
    door({ roles: { [STAFF]: 'staff' }, verifies: STAFF }),
    token(STAFF)
  )
  same(account.status, undefined, 'no refusal')
  same(account.userId, STAFF, 'let through')
  same(account.role, 'staff', 'the role comes back on the account')
})

check('a representative is still refused at the admin door', async () => {
  const answer = await authorizeAdmin(
    door({ roles: { [STAFF]: 'staff' }, verifies: STAFF }),
    token(STAFF)
  )
  same(answer.status, 403, 'refused')
  same(answer.userId, undefined, 'no account handed back')
})

check('an admin is let through the caller door as well', async () => {
  // The console's own calling screen is this same list, and the person who set
  // the list up works it too.
  const account = await authorizeCaller(
    door({ roles: { [ADMIN]: 'admin' }, verifies: ADMIN }),
    token(ADMIN)
  )
  same(account.status, undefined, 'no refusal')
  same(account.role, 'admin', 'the role is what narrows the hand-over inside')
})

check('a client reaches neither door', async () => {
  const clients = door({ roles: { [CLIENT]: 'client' }, verifies: CLIENT })
  same((await authorizeCaller(clients, token(CLIENT))).status, 403, 'refused by the caller door')
  same((await authorizeAdmin(clients, token(CLIENT))).status, 403, 'refused by the admin door')
})

check('an account with no profile row reaches neither door', async () => {
  const clients = door({ roles: {}, verifies: CLIENT })
  same((await authorizeCaller(clients, token(CLIENT))).status, 403, 'refused by the caller door')
  same((await authorizeAdmin(clients, token(CLIENT))).status, 403, 'refused by the admin door')
})

check('a forged token naming a representative is refused', async () => {
  const answer = await authorizeCaller(
    door({ roles: { [STAFF]: 'staff' }, verifies: null }),
    token(STAFF)
  )
  same(answer.status, 401, 'refused')
})

check('a role that would not read is never a yes at the caller door either', async () => {
  const clients = door({ roles: { [STAFF]: new Error('policy') }, verifies: STAFF })
  same((await authorizeCaller(clients, token(STAFF))).status, 500, 'unknown is not staff')
})

check('only the two call endpoints admit a representative', async () => {
  // Read off the tree rather than off a list, so an endpoint that reaches for
  // the wider helper next year fails here rather than shipping quietly.
  const widened = endpoints().filter(file =>
    /\bauthorizeCaller\b/.test(readFileSync(join(ROOT, file), 'utf8'))
  )
  same(widened.sort().join(','), [...CALLER_DOORS].sort().join(','), 'the widened set')
})

/** Every endpoint in the tree, so the assertion above cannot miss a new one. */
function endpoints() {
  return filesUnder(join(ROOT, 'api'), /\.js$/).map(file => relative(ROOT, file))
}

const passed = await finish({ listed: true })
console.log(`\ncaller door: ${passed}/${cases.length} passed`)
