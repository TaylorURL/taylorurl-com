/**
 * Proves the call data is the owner's alone.
 *
 * The call list used to have a wider door than every other admin endpoint: a
 * `staff` role a representative was given, which reached the list, the call
 * desk, the team board and the audit email and nothing else. There is no team
 * any more, and the endpoint that reads the list and records every call now
 * stands behind the same admin door as the rest of the studio's side. A
 * representative's account, a client's, and an account with no profile row are
 * all refused there, and a forged token is refused before any of that.
 *
 * The risk is a door quietly widening again, so the tree is read as well: no
 * endpoint may admit any role but admin to the call data.
 *
 *   node scripts/auth/check-caller-door.js
 */

import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as clientsModule from '../../lib/db/clients.js'
import { cases, check, finish, same } from '../harness/checks.js'
import { filesUnder } from '../harness/files.js'
import { token } from './token-fixture.js'

const { authorizeAdmin } = clientsModule

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const ADMIN = 'account-admin'
const STAFF = 'account-staff'
const CLIENT = 'account-client'

/** The endpoints that read or write `outreach_calls`. */
const CALL_DOORS = ['api/calls-admin.js']

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

check('the owner is let through', async () => {
  const account = await authorizeAdmin(
    door({ roles: { [ADMIN]: 'admin' }, verifies: ADMIN }),
    token(ADMIN)
  )
  same(account.status, undefined, 'no refusal')
  same(account.userId, ADMIN, 'let through')
})

check('a representative account is refused', async () => {
  const answer = await authorizeAdmin(
    door({ roles: { [STAFF]: 'staff' }, verifies: STAFF }),
    token(STAFF)
  )
  same(answer.status, 403, 'refused')
  same(answer.userId, undefined, 'no account handed back')
})

check('a client is refused', async () => {
  const clients = door({ roles: { [CLIENT]: 'client' }, verifies: CLIENT })
  same((await authorizeAdmin(clients, token(CLIENT))).status, 403, 'refused')
})

check('an account with no profile row is refused', async () => {
  const clients = door({ roles: {}, verifies: CLIENT })
  same((await authorizeAdmin(clients, token(CLIENT))).status, 403, 'refused')
})

check('a forged token naming the owner is refused', async () => {
  const answer = await authorizeAdmin(
    door({ roles: { [ADMIN]: 'admin' }, verifies: null }),
    token(ADMIN)
  )
  same(answer.status, 401, 'refused')
})

check('a role that would not read is never a yes', async () => {
  const clients = door({ roles: { [ADMIN]: new Error('policy') }, verifies: ADMIN })
  same((await authorizeAdmin(clients, token(ADMIN))).status, 500, 'unknown is not admin')
})

check('the wider caller door is gone', () => {
  same('authorizeCaller' in clientsModule, false, 'lib/db/clients.js still exports it')
})

check('every endpoint that touches the calls stands behind the admin door', () => {
  // Read off the tree rather than off a list, so an endpoint that starts
  // reading the calls next year is held to the same door.
  const touching = endpoints().filter(file =>
    /\boutreach_calls\b|\bCALLS\b/.test(readFileSync(join(ROOT, file), 'utf8'))
  )
  for (const file of new Set([...CALL_DOORS, ...touching])) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    same(/\bauthorizeAdmin\(/.test(text), true, `${file} asks the admin door`)
    same(/'staff'/.test(text), false, `${file} names the staff role`)
  }
})

/** Every endpoint in the tree, so the assertion above cannot miss a new one. */
function endpoints() {
  return filesUnder(join(ROOT, 'api'), /\.js$/).map(file => relative(ROOT, file))
}

const passed = await finish({ listed: true })
console.log(`call data door: ${passed}/${cases.length} passed`)
