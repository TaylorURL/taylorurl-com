#!/usr/bin/env node
/**
 * Put one of every message the studio sends into a real inbox.
 *
 * Three families render in three unrelated ways and none of them can be looked
 * at as a message: the newsletter console draws its preview in an iframe, an
 * outreach draft is only ever stored as a row, and the confirmation exists
 * nowhere but in the inbox of whoever has just signed up. A change to any of
 * them otherwise ships on the strength of the source.
 *
 * Every body here is rendered by the code that sends it — `compose` for
 * outreach, `renderIssueEmail` for the newsletter, and the confirmation module
 * put through the same resolver its deployment uses. Nothing is retyped, so a
 * preview that looks right is the message being right.
 *
 * Usage:
 *   node scripts/mail/preview-emails.mjs --dry-run [--out DIR]
 *   node scripts/mail/preview-emails.mjs --to first@example.com --only outreach-speed
 *   node scripts/mail/preview-emails.mjs --to first@example.com --issue <uuid>
 *   node scripts/mail/preview-emails.mjs --to first@example.com --to second@example.com
 *   node scripts/mail/preview-emails.mjs --to first@example.com --asset-origin https://build.vercel.app
 *
 * RESEND_API_KEY has to be in the environment for a send. It is the studio's
 * own key, held in CryptoFort as `taylorurl-resend-api-key`:
 *
 *   ~/.intelligence/tools/with-credential.py \
 *     taylorurl-resend-api-key=RESEND_API_KEY -- node scripts/mail/preview-emails.mjs --to first@example.com
 *
 * A send with no `--to` is refused, and no recipient is read from the database.
 * The only addresses this reaches are the ones named on the command line.
 *
 * `--issue` renders a real row from `newsletter_issues` in place of the sample,
 * drawn twice because one issue is two letters -- the blocks a client sees and
 * the blocks a prospect sees are not the same set. It reads the issue with the
 * service role key, which the vault holds as `supabase-service-role-sunday`:
 *
 *   ~/.intelligence/tools/with-credential.py \
 *     taylorurl-resend-api-key=RESEND_API_KEY \
 *     supabase-service-role-sunday=SUPABASE_SERVICE_ROLE_KEY \
 *     -- node scripts/mail/preview-emails.mjs --to first@example.com --issue <uuid>
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FAMILIES, renderFamily } from '../../lib/mail/catalogue.js'
import { renderIssueEmail } from '../../lib/mail/emailTemplate.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const FROM = 'TaylorURL <newsletter@taylorurl.com>'

// The subject a preview arrives under, so a copy of a cold message sitting in
// the studio's own inbox cannot be mistaken for one a prospect received.
const SUBJECT_PREFIX = '[Preview] '

// The origin every image in a message is served from once it has landed.
const ASSET_ORIGIN = 'https://www.taylorurl.com'

/** Read the flags off the command line. */
function readArguments(argv) {
  const to = []
  let dryRun = false
  let out = null
  let assetOrigin = null
  let issue = null
  const only = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--to') to.push(argv[(index += 1)])
    else if (argv[index] === '--dry-run') dryRun = true
    else if (argv[index] === '--out') out = argv[(index += 1)]
    else if (argv[index] === '--asset-origin') assetOrigin = argv[(index += 1)]
    else if (argv[index] === '--only') only.push(argv[(index += 1)])
    else if (argv[index] === '--issue') issue = argv[(index += 1)]
  }
  return { to: to.filter(Boolean), dryRun, out, assetOrigin, only: only.filter(Boolean), issue }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'

/**
 * One row of `newsletter_issues`, by id.
 *
 * A sample issue proves the frame draws; it says nothing about the letter that
 * is actually going out, which is written in the console and lives only in the
 * database.
 */
async function fetchIssue(id) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  const url = `${SUPABASE_URL}/rest/v1/newsletter_issues?select=*&id=eq.${encodeURIComponent(id)}`
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!response.ok) throw new Error(`the issue could not be read (${response.status})`)
  const [row] = await response.json()
  if (!row) throw new Error(`no issue has the id ${id}`)
  return row
}

/** Both letters one issue draws, named by the side of the list each goes to. */
function issuePreviews(issue) {
  return ['client', 'prospect'].map(audience => {
    const drawn = renderIssueEmail({
      issue,
      subscriber: { unsub_token: 'preview', source: audience === 'client' ? 'client' : 'outreach' },
      unsubscribeEndpoint: 'https://www.taylorurl.com/unsubscribe',
    })
    return {
      slug: `newsletter-${audience}`,
      what: `Newsletter issue, the ${audience} copy`,
      subject: drawn.subject,
      html: drawn.html,
      text: drawn.text,
    }
  })
}

/**
 * Point the images at a build that is not the live site.
 *
 * A message names its images absolutely, so a portrait added on a branch is a
 * broken frame in a preview until that branch lands — which is the wrong order
 * to look at it in. Only the image paths move; every link still opens the live
 * site, because those are what a recipient follows and what a preview is for
 * checking.
 */
function fromBuild(html, origin) {
  return html.split(`${ASSET_ORIGIN}/images/`).join(`${origin.replace(/\/$/, '')}/images/`)
}

/**
 * The confirmation bodies, built by the edge module rather than by a copy of
 * it. The endpoint around it reaches for Deno's environment on load, which is
 * why the bodies live in a module of their own.
 */
function confirmation() {
  return confirmationBodies(
    'https://www.taylorurl.com/subscribe/confirm?token=preview',
    'https://www.taylorurl.com/unsubscribe?token=preview'
  )
}

/** Every message, rendered by the code that sends it. */
function previews() {
  return FAMILIES.filter(family => family.previewable !== false).map(family => {
    const drawn = renderFamily(family.slug)
    return {
      slug: family.slug,
      what: family.label,
      subject: drawn.subject,
      html: drawn.html,
      text: drawn.text,
    }
  })
}

/** Hand one message to Resend, addressed to every recipient named. */
async function send(preview, to, key) {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: `${SUBJECT_PREFIX}${preview.subject}`,
      html: preview.html,
      text: preview.text,
    }),
  })
  if (!response.ok) throw new Error(`${preview.slug}: resend refused it (${response.status})`)
}

const { to, dryRun, out, assetOrigin, only, issue } = readArguments(process.argv.slice(2))
const drawn = issue ? issuePreviews(await fetchIssue(issue)) : previews()
const rendered = drawn
  .filter(preview => !only.length || only.includes(preview.slug))
  .map(preview =>
    assetOrigin ? { ...preview, html: fromBuild(preview.html, assetOrigin) } : preview
  )

if (only.length && !rendered.length) {
  console.error(`No message is called ${only.join(', ')}.`)
  process.exit(1)
}

if (dryRun) {
  const directory = out ? path.resolve(out) : path.join(root, '.preview-emails')
  mkdirSync(directory, { recursive: true })
  for (const preview of rendered) {
    writeFileSync(path.join(directory, `${preview.slug}.html`), preview.html)
    writeFileSync(path.join(directory, `${preview.slug}.txt`), preview.text)
    console.log(`${preview.slug}  ${preview.subject}`)
  }
  console.log(`\n${rendered.length} message(s) written to ${directory}`)
  process.exit(0)
}

if (!to.length) {
  console.error('Name a recipient with --to, or pass --dry-run to write the files instead.')
  process.exit(1)
}

const key = process.env.RESEND_API_KEY
if (!key) {
  console.error('RESEND_API_KEY is not set. Pass it in with with-credential.py.')
  process.exit(1)
}

if (assetOrigin) console.log(`images served from ${assetOrigin}`)

for (const preview of rendered) {
  await send(preview, to, key)
  console.log(`sent  ${preview.what}  ->  ${to.join(', ')}`)
}
