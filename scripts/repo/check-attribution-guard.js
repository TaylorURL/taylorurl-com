#!/usr/bin/env node
/**
 * That the guard in front of the attribution gate actually holds.
 *
 *   npm run check:attribution-guard
 *
 * `.github/workflows/ci.yml` refuses a commit written under an AI identity or
 * carrying attribution in its message, and it says of itself that nothing there
 * is fixed by editing it. It is right, and it is also the last line rather than
 * the first: it runs on a pull request, so a push straight to a branch never
 * meets it. Two commits authored `Claude <noreply@anthropic.com>` reached
 * `develop` twenty minutes apart that way, and a branch that refuses a
 * force-push does not let them back out — the cost of catching it late is a
 * release nobody can cut.
 *
 * So the same rules are applied one step earlier, in `.githooks/`, where a
 * commit has not been written yet. That only works while the two agree about
 * what attribution is, and they are in different languages in different files
 * with nothing joining them. This runs the hooks against commits that should
 * and should not be refused, and reads the workflow to confirm the patterns
 * are still the ones it enforces.
 *
 * The hooks run against a scratch repository rather than this one, so a check
 * of what git does is what git actually did, and nothing it commits is here.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const HOOKS = path.join(ROOT, '.githooks')

const failures = []
let checks = 0

function check(what, ok) {
  checks += 1
  if (!ok) failures.push(what)
}

/**
 * One commit attempted in a throwaway repository, and what came of it.
 *
 * @returns {{ok: boolean, message: string, output: string}} Whether git took
 *   it, and the message it ended up storing.
 */
function commitIn(repo, { name, email, message, file = 'a.txt', body = String(Math.random()) }) {
  writeFileSync(path.join(repo, file), body)
  const git = (...args) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: 'pipe' })
  git('add', '-A')
  git('config', 'user.name', name)
  git('config', 'user.email', email)

  // A hook says what it did on stderr and git says what it committed on
  // stdout, so both halves are needed whether the commit was taken or not.
  const run = spawnSync('git', ['-C', repo, 'commit', '-m', message], { encoding: 'utf8' })
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  if (run.status !== 0) return { ok: false, message: '', output }
  return { ok: true, message: git('log', '-1', '--format=%B').trimEnd(), output }
}

function scratchRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), 'attribution-guard-'))
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' })
  git('init', '-q', '-b', 'main')
  git('config', 'core.hooksPath', HOOKS)
  git('config', 'commit.gpgsign', 'false')
  return repo
}

const HUMAN = { name: 'Trenton Taylor', email: 'trenton.taylor.email@gmail.com' }
const AGENT = { name: 'Claude', email: 'noreply@anthropic.com' }

const repo = scratchRepo()

try {
  /* --------------------------------------------------------------------- *
   * The identity a commit is written under.
   * --------------------------------------------------------------------- */

  const byPerson = commitIn(repo, { ...HUMAN, message: 'Add a thing' })
  check('a person can commit', byPerson.ok)

  const byAgent = commitIn(repo, { ...AGENT, message: 'Add another thing' })
  check('an AI identity is refused', !byAgent.ok)
  check(
    'the refusal says how to fix it rather than only that it failed',
    /git config user\.name/.test(byAgent.output)
  )

  // The vendor list is not one name. A session configured as any of them is
  // the same failure and has to be refused the same way.
  for (const vendor of [
    { name: 'Codex', email: 'bot@openai.com' },
    { name: 'Copilot', email: 'copilot@github.com' },
    { name: 'Cursor Agent', email: 'agent@cursor.com' },
  ]) {
    const attempt = commitIn(repo, { ...vendor, message: 'Add a thing' })
    check(`${vendor.name} is refused too`, !attempt.ok)
  }

  // dependabot authors no prose, and refusing it was never the point.
  const byDependabot = commitIn(repo, {
    name: 'dependabot[bot]',
    email: '49699333+dependabot[bot]@users.noreply.github.com',
    message: 'Bump a dependency',
  })
  check('dependabot still commits', byDependabot.ok)

  /* --------------------------------------------------------------------- *
   * The trailers a harness appends after the message was written.
   * --------------------------------------------------------------------- */

  const trailed = commitIn(repo, {
    ...HUMAN,
    message: [
      'Move the badge with the version',
      '',
      'The badge and the manifest have to agree, so they move together.',
      '',
      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>',
      'Claude-Session: https://claude.ai/code/session_0123456789',
    ].join('\n'),
  })
  check('a trailered commit is still taken', trailed.ok)
  check('the trailers are gone', !/Co-Authored-By|Claude-Session|claude\.ai/i.test(trailed.message))
  check('the subject survives', trailed.message.startsWith('Move the badge with the version'))
  check(
    'the body survives',
    trailed.message.includes('The badge and the manifest have to agree, so they move together.')
  )
  check('no blank lines are left hanging on the end', !/\n\s*$/.test(trailed.message))
  check(
    'the removal is reported rather than silent',
    /took the AI attribution out/.test(trailed.output)
  )

  const marked = commitIn(repo, {
    ...HUMAN,
    message: 'Ship it\n\n\u{1F916} Generated with [Claude Code](https://claude.com/claude-code)',
  })
  check('the generated-with footer is taken out', marked.ok && marked.message === 'Ship it')

  // The patterns are anchored on the trailer and the phrase, so a commit whose
  // subject is about a vendor is a commit that still reads as it was written.
  const aboutAVendor = commitIn(repo, {
    ...HUMAN,
    message: 'Answer questions about Claude and OpenAI on the FAQ page',
  })
  check(
    'prose that names a vendor is left alone',
    aboutAVendor.ok &&
      aboutAVendor.message === 'Answer questions about Claude and OpenAI on the FAQ page'
  )

  const nothingElse = commitIn(repo, {
    ...HUMAN,
    message: 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>',
  })
  check('a message that was only attribution is refused', !nothingElse.ok)
} finally {
  rmSync(repo, { recursive: true, force: true })
}

/* ------------------------------------------------------------------------ *
 * The hooks and the workflow still mean the same thing.
 * ------------------------------------------------------------------------ */

const workflow = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
const shared = readFileSync(path.join(HOOKS, 'attribution.sh'), 'utf8')

// Every pattern the workflow refuses by, as it spells it.
const workflowPatterns = [...workflow.matchAll(/^\s*(?:ident|msg)\+?='(.+)'$/gm)].map(m => m[1])

check('the workflow still states its patterns where they can be read', workflowPatterns.length >= 4)
for (const pattern of workflowPatterns) {
  check(
    `the hooks carry the workflow's pattern: ${pattern.slice(0, 46)}…`,
    shared.includes(pattern)
  )
}

// The session hook is what points a fresh clone at any of this.
const sessionHook = readFileSync(path.join(ROOT, '.claude/hooks/session-start.sh'), 'utf8')
const settings = JSON.parse(readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'))

check(
  'the session hook points git at the tracked hooks',
  /core\.hooksPath\s+\.githooks/.test(sessionHook)
)
check('the session hook replaces an AI identity', /AI_IDENTITY/.test(sessionHook))
check('a person who set their own name keeps it', /grep -qiE "\$AI_IDENTITY"/.test(sessionHook))
check(
  'the settings register the hook on SessionStart',
  settings.hooks?.SessionStart?.[0]?.hooks?.[0]?.command?.includes('session-start.sh')
)

// Tracked, or none of it reaches the clone a session actually starts on.
const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', '.claude', '.githooks'], {
  encoding: 'utf8',
})
for (const wanted of [
  '.claude/settings.json',
  '.claude/hooks/session-start.sh',
  '.githooks/pre-commit',
  '.githooks/commit-msg',
  '.githooks/attribution.sh',
]) {
  check(`${wanted} is tracked, so a fresh clone has it`, tracked.includes(wanted))
}

if (failures.length) {
  console.error('check-attribution-guard: failed')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('  the hooks live in .githooks/, the wall behind them in .github/workflows/ci.yml')
  process.exit(1)
}

console.log(
  `check-attribution-guard: ${checks} checks hold — an AI identity cannot commit, the trailers are ` +
    `taken out of the message, prose naming a vendor is untouched, and the hooks still enforce the ` +
    `patterns the workflow does`
)
