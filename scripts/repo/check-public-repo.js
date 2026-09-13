/**
 * Proves the tree carries nothing about a customer that a stranger may not read.
 *
 * The repository is public. Every other check here asks whether the code is
 * right; this one asks who is named in it, because those are different
 * questions and only one of them is answered by the tests passing.
 *
 * Three kinds of fact used to be in here and are now rows in the database. A
 * Stripe id says which record in the account a person is. An address at a
 * domain the studio does not own is somebody's mailbox. A held domain is a
 * company that asked not to be written to, which is the one list where being
 * on it at all is the sensitive part. None of the three can be written in a
 * source file again without this failing.
 *
 * What passes is an address nobody can own. RFC 2606 reserves example.com and
 * the .example, .test, .invalid and .localhost top levels precisely so a
 * fixture can name a business without naming a business, and a fixture that
 * uses them cannot collide with a real company however it is edited later.
 *
 * The two allowances are narrow and both are about companies rather than
 * people: a vendor whose own service the code names, and a mail host on the
 * throwaway list, which is a blocklist and useless without the real names.
 */

import { execFileSync } from 'node:child_process'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fail, finish } from '../harness/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** Domains the studio owns, which are its own to publish. */
const OURS = ['taylorurl.com', 'taylor.website', 'taylorwebsite.com', 'baytownwebdevelopment.com']

/** Hosts a fixture may use because nobody can register them. RFC 2606 and 6761. */
const RESERVED = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/

/**
 * Companies the code names because it talks to them or refuses them, rather
 * than because they are customers.
 */
const VENDORS = new Set([
  'anthropic.com',
  'cursor.com',
  'github.com',
  'google.com',
  'guerrillamail.com',
  'mailinator.com',
  'microsoft.com',
  'openai.com',
  'resend.com',
  'sentry.io',
  'stripe.com',
  'supabase.co',
  'supabase.com',
  'vercel.com',
  'yelp.com',
  'yopmail.com',
])

/**
 * Businesses invented to stand in for a customer, and the near misses that
 * prove the reserved list above is read exactly.
 *
 * A fixture written today should use a reserved domain instead. These are the
 * ones already in the tree that plainly name nobody: a shop called shop.com, a
 * business called realbusiness.com, and the handful of domains that exist only
 * to be almost 'example.com' and get refused anyway.
 */
const FIXTURES = new Set([
  'alfa.com',
  'b.com',
  'contest.co.uk',
  'example.company',
  'examples.com',
  'invalidation.org',
  'localhost.com',
  'my-example.com',
  'notexample.com',
  'realbusiness.com',
  'shop.com',
  'site.com',
  'testing.com',
  'yourbusiness.com',
  'yourcompany.com',
])

/**
 * The clients the studio publishes.
 *
 * Read off the portfolio rather than typed again, because a client named on the
 * marketing site is already public and a second list here would be the one that
 * went stale. What is private about a client is what they pay and how they are
 * billed, and none of that is a hostname.
 */
const PORTFOLIO = new Set(
  PORTFOLIO_PROJECTS.map(project =>
    String(project.displayUrl || '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase()
  ).filter(Boolean)
)

/** Retina and asset filenames read as addresses. They are not. */
const ASSET = /\.(png|jpe?g|webp|svg|gif|avif|ico)$/i

/**
 * The two addresses at a mail host the studio does not own that are still not
 * a customer's.
 *
 * Free mail is where a one-person trade actually reads its post, so the host is
 * not allowed wholesale - that would blind this to the very addresses it exists
 * to catch. These two are named one at a time instead.
 */
const ALLOWED = new Set([
  // The identity commits are authored under. It is on every commit in the
  // history already, so a file naming it publishes nothing a clone does not.
  'trenton.taylor.email@gmail.com',
  // Marketing copy on the business email page, standing for the address a
  // reader is being talked out of. It names no one.
  'yourbusiness@gmail.com',
])

/** Files worth reading: everything tracked that a person wrote. */
const READABLE = /\.(js|jsx|mjs|cjs|json|md|html|py|yml|yaml)$/

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(name => READABLE.test(name) && name !== 'package-lock.json')

/** A live Stripe identifier names one record in the account. */
const STRIPE_ID = /\b(cus|sub|in|pi|cs|prod|price|ch|card|pm)_[A-Za-z0-9]{14,}\b/g

/** Anything shaped like a mailbox. */
const ADDRESS = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g

for (const name of tracked) {
  let body
  try {
    body = readFileSync(join(ROOT, name), 'utf8')
  } catch {
    continue
  }

  body.split('\n').forEach((line, index) => {
    const where = `${name}:${index + 1}`

    for (const [id] of line.matchAll(STRIPE_ID)) {
      // A fixture says so in the id itself, which is the only way to write one
      // that is plainly not an account record.
      if (/sample|fixture|example|test|fake|xxxx/i.test(id)) continue
      fail(`${where}: a Stripe identifier, ${id}`)
    }

    for (const [address, ,] of line.matchAll(ADDRESS)) {
      const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase()
      if (ALLOWED.has(address.toLowerCase())) continue
      if (ASSET.test(domain)) continue
      if (OURS.includes(domain)) continue
      if (RESERVED.test(domain)) continue
      if (VENDORS.has(domain)) continue
      if (FIXTURES.has(domain)) continue
      if (PORTFOLIO.has(domain)) continue
      fail(`${where}: an address at a domain the studio does not own, ${address}`)
    }
  })
}

await finish({
  hint:
    'This tree names people it may not name in public. A customer fact belongs in the database.\n' +
    'A fixture belongs on example.com or a reserved top level, which nobody can register.',
})

console.log(
  `public repo: ${tracked.length} tracked files carry no Stripe identifier and no address ` +
    'outside the studio’s own domains and the reserved ones'
)
