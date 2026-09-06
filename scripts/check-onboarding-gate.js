/**
 * Proves the console behaves like a build tracker while a build is running, and
 * like a console once one is not.
 *
 * `inOnboarding` is the whole of what the word means in this codebase now. The
 * kit of five documents is gone; what is left is one derived boolean - this
 * account has a build that has not finished - and it decides three things at
 * once: which sections the menu offers, where a signed-in client is sent, and
 * whether the dock in the corner is drawn.
 *
 * Where a client is sent has two answers rather than one. Until their brief has
 * been handed over it is the only thing the build is waiting on, so that is
 * where they land; afterwards the tracker is the whole of what there is to
 * look at. Both halves fail the same quiet way as the rest of this file: a
 * client sent to the tracker with an unanswered brief sees a bar that cannot
 * move and no reason given, and one sent to the brief forever cannot reach the
 * updates written about their own site.
 *
 * That makes it the most consequential branch in the console and the one with
 * the least standing behind it. Every part of it fails quietly:
 *
 *   - a redirect that stops firing leaves a client on a traffic page for a site
 *     that does not exist yet;
 *   - a redirect that never stops firing traps a finished client on their own
 *     tracker with no way to reach anything else;
 *   - a section that forgets `duringBuild` appears in a menu during a build and
 *     answers with an empty panel.
 *
 * None of those is an error and none of them throws. The functions are imported
 * and run here rather than read for their text, because what matters is the
 * answer each one gives.
 *
 *   npm run check:onboarding-gate
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentProject, inOnboarding, stageRank } from '../src/app/views/console/lib/stages.js'

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

const FRAME = 'src/app/views/console/ConsoleFrame.jsx'
const SECTIONS = 'src/app/views/console/lib/sections.js'

/** A build part-way through, and one that has launched. */
const RUNNING = { project_id: 'a', status: 'active', stage: 'design', created_at: '2026-01-01' }
const DONE = {
  project_id: 'b',
  status: 'complete',
  stage: 'live',
  created_at: '2025-01-01',
  launched_at: '2026-02-01',
}

check('an account with an unfinished build is in onboarding', () => {
  same(inOnboarding([RUNNING]), true, 'one running build counts')
  same(inOnboarding([DONE, RUNNING]), true, 'a running build counts beside a finished one')
})

check('an account whose builds have all launched is not', () => {
  same(inOnboarding([DONE]), false, 'a finished build does not hold the console shut')
  same(inOnboarding([]), false, 'no build at all is not onboarding')
  same(inOnboarding(null), false, 'a feed that has not answered yet is not onboarding')
})

check('the tracker shows the build somebody is waiting on', () => {
  // The oldest unfinished one, because that is the one they are wondering
  // about; with nothing unfinished, the most recently launched.
  same(currentProject([DONE, RUNNING])?.project_id, 'a', 'an open build wins over a closed one')
  same(currentProject([DONE])?.project_id, 'b', 'with nothing open it is the last launched')
  same(currentProject([]), null, 'nothing is nothing')
})

check('a client in onboarding is sent somewhere a build can answer for', () => {
  const frame = read(FRAME)
  same(frame.includes('inOnboarding'), true, 'the frame asks the question')
  // Both halves matter. Sent nowhere, a client browses a console built around
  // a site that is not made; sent always, a finished client cannot leave.
  same(
    /onboarding && !duringBuild\.has\(here\)[\s\S]{0,200}<Navigate/.test(frame),
    true,
    'an onboarding client away from those addresses is redirected'
  )
  same(
    /onboarding &&/.test(frame) || /onboarding\s*\?/.test(frame),
    true,
    'the redirect is conditional rather than unconditional'
  )
})

check('a client who has sent their brief is sent to the tracker instead', () => {
  const frame = read(FRAME)
  same(
    /Navigate to=\{briefSent \? '\/console\/project' : '\/console\/onboarding'\}/.test(frame),
    true,
    'the landing turns on whether the brief has been sent'
  )
  // Read off the project rather than asked for a second time. A second read is
  // a second answer, and the two disagree for the length of one request.
  same(
    /briefSent = Boolean\(project\?\.onboarding\?\.submitted_at\)/.test(frame),
    true,
    'what has been sent is read off the build the tracker is already about'
  )
})

check('the redirect and the menu read one list', () => {
  const frame = read(FRAME)
  // Written out as hand-kept booleans they drift, and the drift is invisible:
  // a section marked to survive a build that the redirect has not heard of is
  // a row in the menu that bounces the moment it is pressed.
  same(
    frame.includes('SECTIONS.filter(entry => entry.duringBuild).map(sectionHref)'),
    true,
    'the reachable addresses are taken off the catalogue'
  )
  same(
    frame.includes("const onProject = here === '/console/project'"),
    false,
    'no hand-kept copy of the list is left beside it'
  )
})

check('the menu keeps only what a build has a use for', () => {
  const sections = read(SECTIONS)
  same(sections.includes('duringBuild'), true, 'sections say whether they survive a build')
  // The tracker and the public status board. Anything else is a report about a
  // site that does not exist yet.
  //
  // Cut into one chunk per section rather than matched across a window: the
  // meta sentence on a section runs to several hundred characters, so any
  // fixed distance is either too short to reach its own flag or long enough to
  // reach the next section's.
  const kept = sections
    .split(/\n\s*\{\n/)
    .filter(block => block.includes('duringBuild: true'))
    .map(block => block.match(/id: '(\w+)'/)?.[1])
    .filter(Boolean)
  same(kept.includes('onboarding'), true, 'the brief survives a build')
  same(kept.includes('project'), true, 'the tracker survives a build')
  same(kept.includes('status'), true, 'the status board survives a build')
  same(kept.length, 3, 'nothing else does')
})

check('the dock is drawn only where there is something to draw', () => {
  const frame = read(FRAME)
  same(frame.includes('ProjectChecklist'), true, 'the frame mounts the dock')
  // The dock filters to items at or before the stage reached, so an item from
  // a later stage is not on the list.
  const dock = read('src/app/views/console/ProjectChecklist.jsx')
  same(
    dock.includes('stageRank(task.stage) <= reached'),
    true,
    'only what has been reached is asked for'
  )
  same(stageRank('design') <= stageRank('build'), true, 'the ranking it relies on still counts up')
  same(stageRank('nonsense'), 0, 'a stage nothing uses ranks below every real one')
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
