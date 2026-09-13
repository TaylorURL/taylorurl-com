/**
 * Proves the retired onboarding kit is gone from every place it was wired
 * into, and that its five addresses still answer.
 *
 * A route is registered in four files and taken out of four files, and every
 * one of them fails on its own terms. A view left in the lazy map is a chunk
 * built and shipped for a page nothing routes to. A path left in the prerender
 * list builds a static page for a view that no longer exists. A line left in
 * robots asks crawlers to avoid a section that is not there. And a route
 * removed with no redirect behind it turns every link ever sent to a client
 * into a 404, which is the one of the four a person actually meets.
 *
 * The kit was five documents handed to somebody who had already signed, sitting
 * on the open web at `/onboarding`. What answers those addresses now is the
 * console, so that is where the five of them go.
 *
 * What the console holds is a different thing wearing a similar word, and the
 * distinction is the whole of what this file has to be careful about. The kit
 * was public, static, and read; `/console/onboarding` is behind an account, is
 * answered by one signed-in client about their own build, and is written to
 * rather than read. So the rule here is about the five retired addresses and
 * the seven deleted files, and never about the word: a scan for the word turns
 * the console section into a failure the moment it is registered, and a
 * codebase that cannot name a thing is a codebase that names it something
 * worse.
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cases, check, finish, report, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')

/** The five addresses the kit was published at. */
const RETIRED = [
  '/onboarding',
  '/onboarding/intake-questionnaire',
  '/onboarding/process-and-timeline',
  '/onboarding/client-portal',
  '/onboarding/communication-and-support',
]

/** Where a client with one of those links belongs now. */
const ANSWERS = '/console/project'

/** The files the kit was built out of. */
const RETIRED_FILES = [
  'src/app/views/OnboardingWelcome.jsx',
  'src/app/views/OnboardingIntake.jsx',
  'src/app/views/OnboardingProcess.jsx',
  'src/app/views/OnboardingPortal.jsx',
  'src/app/views/OnboardingSupport.jsx',
  'src/app/components/OnboardingDoc.jsx',
  'src/app/constants/onboarding.js',
]

check('none of the retired views is still in the tree', () => {
  const faults = RETIRED_FILES.filter(path => existsSync(join(ROOT, path))).map(
    path => `${path} is still here`
  )
  report(faults)
})

check('nothing routes to them, builds them, or asks a crawler to skip them', () => {
  const faults = []

  // A retired view can only be mounted by name, so the names are what is looked
  // for. The bare word would catch the console's own section as well, which is
  // the one thing here that is meant to exist, so this asks after the five view
  // keys and nothing else. The constants module and the shared document
  // component are covered by the case above, which asserts the files are gone.
  for (const path of RETIRED_FILES.filter(one => one.startsWith('src/app/views/'))) {
    const key = path.match(/\/(\w+)\.jsx$/)?.[1]
    if (!key) continue
    if (read('src/app/views.js').includes(`@views/${key}`)) {
      faults.push(`src/app/views.js still imports ${key}`)
    }
    if (read('src/app/constants/routes.js').includes(`'${key}'`)) {
      faults.push(`src/app/constants/routes.js still routes ${key}`)
    }
  }

  // The addresses themselves, in the two files that would build one or point a
  // crawler at one. Each is matched whole, so `/console/onboarding` - a
  // different address behind an account - is not read as `/onboarding`.
  const bounded = source =>
    RETIRED.filter(address =>
      new RegExp(`(^|[\\s'"\`])${address}(?=$|[\\s'"\`,])`, 'm').test(source)
    )

  for (const [path, what] of [
    ['vite/site-routes.js', 'prerenders'],
    ['public/robots.txt', 'names to crawlers'],
  ]) {
    for (const address of bounded(read(path))) {
      faults.push(`${path} still ${what} ${address}`)
    }
  }

  report(faults)
})

check('the console section that carries the word now is a different thing', () => {
  // The one case a scan for the word would have caught and been wrong about.
  // It is asserted rather than merely allowed, because the reason the five
  // addresses redirect at all is that a client's onboarding moved behind an
  // account, and a redirect pointing at a section nothing mounts is the same
  // 404 in a longer costume.
  same(
    read('src/app/constants/routes.js').includes(
      "{ key: 'ConsoleOnboarding', path: 'onboarding' }"
    ),
    true,
    'the console mounts an onboarding section'
  )
  same(
    read('src/app/views.js').includes('ConsoleOnboarding:'),
    true,
    'the loader map names its chunk'
  )
  same(
    read('vite/site-routes.js').includes("'/console/onboarding'"),
    true,
    'the section is prerendered like every other console address'
  )
  // Behind an account, so it inherits the console's own line in robots rather
  // than earning one of its own.
  same(read('public/robots.txt').includes('Disallow: /console'), true, 'robots covers the console')
})

check('every retired address is redirected rather than left to 404', () => {
  const { redirects } = JSON.parse(read('vercel.json'))
  const held = new Map(redirects.map(row => [row.source, row]))
  const faults = []
  for (const source of RETIRED) {
    const row = held.get(source)
    if (!row) {
      faults.push(`${source} has no redirect and would answer 404`)
      continue
    }
    if (row.destination !== ANSWERS) {
      faults.push(`${source} points at ${row.destination} rather than ${ANSWERS}`)
    }
    if (row.permanent !== true) faults.push(`${source} is redirected only temporarily`)
  }
  report(faults)
})

check('the address they are sent to is a section that exists', () => {
  same(
    read('vite/site-routes.js').includes(`'${ANSWERS}'`),
    true,
    'the tracker is a prerendered console path'
  )
  same(
    read('src/app/views/console/lib/sections.js').includes("id: 'project'"),
    true,
    'the tracker is a registered section'
  )
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
