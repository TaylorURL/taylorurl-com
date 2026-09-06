/**
 * Proves a client can actually hand over what their build asks them for.
 *
 * The tracker asked for a logo, the words and photographs, and offered a
 * checkbox. Ticking one was a claim rather than a delivery, so every file still
 * arrived by email and the console described a conversation it had no part in.
 * The whole of that failure was invisible: the checklist rendered, the ticks
 * saved, the stage gate worked, and nothing anywhere was broken. It simply
 * asked for things it could not receive.
 *
 * So this is a check about wiring rather than about behaviour. Each layer works
 * perfectly on its own while the chain does nothing:
 *
 *   - a database function with no endpoint calling it,
 *   - an endpoint action with no hook posting to it,
 *   - a hook method with no component holding it,
 *   - a task kind the endpoint accepts and no control draws.
 *
 * Any one of those is a client staring at an ask with no way to answer it, and
 * every one of them looks like working code from the inside.
 *
 * The last case is the one worth keeping longest. A build asks a client for the
 * login to their domain registrar, and a text box that accepts one would put a
 * password into a table beside their photographs. That item stays a tick and
 * the conversation stays off the tracker, so this refuses any wiring that would
 * quietly start collecting one.
 *
 *   npm run check:project-intake
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '..', path), 'utf8')

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want)
    throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

function report(faults) {
  if (faults.length) throw new Error(faults.join('\n      '))
}

const ENDPOINT = 'api/projects.js'
const HOOK = 'src/app/hooks/useProjectFeed.js'
const ASKS = 'src/app/views/console/ProjectAsks.jsx'
const DOCK = 'src/app/views/console/ProjectChecklist.jsx'
const PAGE = 'src/app/views/console/pages/ProjectPage.jsx'

/**
 * Everything the service role may do on a client's behalf.
 *
 * Written out here rather than read off the grant for the same reason the
 * admin list is: the migrations are held privately, so this list is the
 * contract between the two halves.
 */
const CLIENT_FUNCTIONS = [
  'projects_for_account',
  'project_task_tick',
  'project_task_answer',
  'project_task_file',
  'project_task_file_remove',
  'project_task_project',
  'project_mark_seen',
]

/** What a checklist item can ask for, and the control each one draws. */
const KINDS = ['tick', 'text', 'files']

check('every client project function has a caller', () => {
  const endpoint = read(ENDPOINT)
  const faults = CLIENT_FUNCTIONS.filter(name => !endpoint.includes(name)).map(
    name => `${name} exists in the database and is called from nowhere`
  )
  report(faults)
})

check('every write the endpoint answers is posted by the hook', () => {
  const endpoint = read(ENDPOINT)
  const hook = read(HOOK)
  const faults = []
  // Read off the endpoint rather than listed again, so an action added there
  // and never wired up fails here instead of waiting to be noticed.
  const offered = [...endpoint.matchAll(/^\s{4}(\w+): \(\) => \{$/gm)].map(match => match[1])
  same(offered.length > 0, true, 'the endpoint reads its writes off a table')
  for (const action of offered) {
    if (!hook.includes(`action: '${action}'`)) faults.push(`nothing posts { action: '${action}' }`)
  }
  if (!hook.includes("action: 'upload'")) faults.push('nothing asks for a signed upload')
  report(faults)
})

check('every method the hook returns is held by a component', () => {
  const hook = read(HOOK)
  const held = `${read(PAGE)}${read(ASKS)}${read(DOCK)}`
  const faults = []
  // The block the hook hands back, which is the list of things it promises.
  const returned = hook.slice(hook.lastIndexOf('return {'))
  for (const name of ['tick', 'answer', 'send', 'remove', 'markSeen']) {
    if (!returned.includes(`${name},`)) faults.push(`the hook no longer returns ${name}`)
    if (!held.includes(name)) faults.push(`nothing on the tracker calls ${name}`)
  }
  report(faults)
})

check('every kind of ask draws a control', () => {
  const asks = read(ASKS)
  const faults = []
  for (const kind of KINDS) {
    if (!asks.includes(`'${kind}'`)) faults.push(`a ${kind} item has no control on the tracker`)
  }
  same(asks.includes('WrittenAsk'), true, 'a written item draws a box to write in')
  same(asks.includes('FileAsk'), true, 'a file item draws a picker')
  report(faults)
})

check('the dock offers a tick only where a tick is the whole answer', () => {
  const dock = read(DOCK)
  // A checkbox against "Your logo" is the exact fault this whole section was
  // written to close: it lets somebody mark an item done without sending
  // anything, and the stage gate then opens on the strength of it.
  same(
    dock.includes("(task.kind || 'tick') === 'tick'"),
    true,
    'the dock asks what kind of item it is drawing'
  )
  same(dock.includes('console-dock-ask'), true, 'a non-tick item links to where it is answered')
})

check('an upload is signed by the server rather than named by the browser', () => {
  const endpoint = read(ENDPOINT)
  same(
    endpoint.includes('project_task_project'),
    true,
    'the path is composed from ids the database confirmed'
  )
  same(
    endpoint.includes('crypto.randomUUID()'),
    true,
    'the filename is ours rather than the browser’s'
  )
  // A name straight off a file input can climb out of the folder it was meant
  // for, and nothing downstream would notice.
  same(
    /path = `\$\{data\.project_id\}\/\$\{taskId\}\//.test(endpoint),
    true,
    'the folder is the project and the task, in that order'
  )
})

check('no ask collects a credential', () => {
  const faults = []
  // The domain item asks where an address is registered. It must never grow a
  // box that takes the password to it: a registrar login sitting in a task
  // answer is a different kind of record from a photograph, and this file is
  // the only thing standing between the two.
  const credentialish = /\b(password|passphrase|api[_-]?key|secret|credential)\b/i
  for (const path of [ASKS, ENDPOINT]) {
    const body = read(path)
    for (const line of body.split('\n')) {
      // Prose about the rule is how the rule is explained, so only a field or
      // a value counts against it.
      if (!credentialish.test(line)) continue
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue
      faults.push(`${path} names a credential outside a comment: ${line.trim()}`)
    }
  }
  report(faults)
})

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
    console.log(`  ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  no  ${name}\n      ${error.message}`)
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
