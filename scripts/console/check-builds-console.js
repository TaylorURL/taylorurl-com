/**
 * Proves that nothing the database offers for moving a build along is left
 * with no way to reach it.
 *
 * This is the fault the section was written for. The project functions existed
 * for a day with no caller anywhere: a stage could only be moved by writing SQL
 * by hand, and nothing said so, because a function nobody calls looks exactly
 * like a function that works.
 *
 * The migrations are held privately, so the names are written out here rather
 * than read off the grant. That makes this list the contract between the two
 * halves: a function added there and not added here is not covered, and a
 * function named here that no endpoint calls fails the run. It is the weaker
 * of the two arrangements and the only one available to a public tree.
 *
 * The second fault is the section existing in some places and not others. A
 * console section is registered in four files and three of them fail quietly:
 * the menu offers a row that routes nowhere, or the route answers and the menu
 * never shows it, or a direct load is a 404 because nothing prerendered the
 * shell.
 */

import { cases, check, finish, report, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const ENDPOINT = 'api/projects-admin.js'
const PAGE = 'src/app/views/console/pages/studio/BuildsPage.jsx'
const HOOK = 'src/app/hooks/console/useBuildsFeed.js'

/** Everything the service role may do to a build, and nothing a client may. */
const ADMIN_FUNCTIONS = [
  'admin_projects',
  'admin_project_stage',
  'admin_project_update',
  'admin_project_media',
  'admin_project_site',
  'admin_project_task',
  'admin_project_task_remove',
  'admin_project_claim',
]

/** The six stages, which are a check constraint in the database as well. */
const STAGES = ['received', 'getting_started', 'design', 'build', 'checks', 'live']

check('every admin project function has a caller', () => {
  const endpoint = read(ENDPOINT)
  const faults = ADMIN_FUNCTIONS.filter(name => !endpoint.includes(name)).map(
    name => `${name} exists in the database and is called from nowhere`
  )
  report(faults)
})

check('the endpoint asks for the admin role rather than for a session', () => {
  const endpoint = read(ENDPOINT)
  same(endpoint.includes('authorizeAdmin'), true, 'authorizeAdmin is the door')
  same(
    /authorizeAccount\s*\(/.test(endpoint),
    false,
    'no plain session check stands in for the role check'
  )
})

check("the client's own endpoint knows none of the admin functions", () => {
  const client = read('api/projects.js')
  const faults = ADMIN_FUNCTIONS.filter(name => client.includes(name)).map(
    name => `api/projects.js names ${name}, which a client may not reach`
  )
  report(faults)
})

check('the builds section is registered everywhere a section is registered', () => {
  const faults = []
  const places = [
    ['src/app/views/console/lib/sections.js', "id: 'builds'"],
    ['src/app/constants/routes.js', "key: 'ConsoleBuilds', path: 'builds'"],
    ['src/app/views.js', 'ConsoleBuilds:'],
    ['vite/site-routes.js', "'/console/builds'"],
  ]
  for (const [path, needle] of places) {
    if (!read(path).includes(needle)) faults.push(`${path} does not carry the builds section`)
  }
  report(faults)
})

check('the section is admin-only and asks for no site in scope', () => {
  const sections = read('src/app/views/console/lib/sections.js')
  const entry = sections.slice(sections.indexOf("id: 'builds'"))
  const body = entry.slice(0, entry.indexOf('},'))
  same(/admin: true/.test(body), true, 'admin only')
  same(/scope: false/.test(body), true, 'no site in scope')
})

check('the console offers every stage the database allows', () => {
  same(read(PAGE).includes("from '../../lib/stages'"), true, 'the page reads the shared stages')
  const stages = read('src/app/views/console/lib/stages.js')
  const faults = STAGES.filter(id => !stages.includes(`id: '${id}'`)).map(
    id => `the database allows the stage ${id} and the console does not offer it`
  )
  report(faults)
})

check('a capture goes up in two steps rather than through the request body', () => {
  same(read(ENDPOINT).includes('createSignedUploadUrl'), true, 'the endpoint signs an upload')
  const hook = read(HOOK)
  const upload = read('src/app/hooks/console/endpoint.js')
  same(hook.includes('putSigned(place.url, file,'), true, 'the browser writes the file itself')
  same(upload.includes("method: 'PUT'"), true, 'the browser writes the file itself')
  // The file is the body of that request rather than a field inside a JSON
  // one, which keeps a full-page capture clear of a request cap that has
  // nothing to do with how big a screenshot ought to be.
  same(/\n\s*body: file,/.test(upload), true, 'the file is the body of the upload')
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
