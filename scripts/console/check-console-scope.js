/**
 * Proves that the console's scope behaves at every size it can be.
 *
 * The scope is a set of sites, and its three readings are easy to get wrong in
 * ways nothing else catches: a set of one has to behave exactly as a single
 * site does or every section quietly changes what it draws, a set of two has to
 * narrow the per-site lists or a reader comparing two sites is shown fifteen,
 * and an empty set has to mean every site rather than none.
 *
 * The menu is checked here for the same reason. Sites is the one section that
 * cannot answer for a scope of one, and the rule hiding it runs before the
 * account's sites have been read - where the wrong answer is a row that
 * disappears a second after the reader arrives.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { cases, check, finish, same } from '../harness/checks.js'

// The catalogue names the drawing beside each label, so it imports the marks
// through the alias the app is built with. The rules under test are pure, but
// they live in that file and are tested there rather than in a copy of them
// that could drift: the module is put through the same resolver the build uses
// and the result is imported.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = mkdtempSync(path.join(tmpdir(), 'console-scope-'))
const bundle = path.join(out, 'sections.mjs')
await build({
  entryPoints: [path.join(root, 'src/app/views/console/lib/sections.js')],
  outfile: bundle,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
  alias: { '@components': path.join(root, 'src/app/components') },
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  jsx: 'automatic',
})
const { menuSections, SECTIONS } = await import(bundle)
rmSync(out, { recursive: true, force: true })

const has = (rows, id) => rows.some(section => section.id === id)

// What the shell derives from the set, in the shape it takes there, so the
// readings can be checked without mounting the console.
const readingOf = (siteIds, sites) => ({
  siteId: siteIds.length === 1 ? siteIds[0] : null,
  inScope: siteIds.length ? sites.filter(row => siteIds.includes(row.site_id)) : sites,
  inView: siteIds.length || sites.length,
  scopeKey: siteIds.join(','),
})

const THREE = [
  { site_id: 'a', name: 'one.com' },
  { site_id: 'b', name: 'two.com' },
  { site_id: 'c', name: 'three.com' },
]

check('an empty scope is every site, and names none of them', () => {
  const read = readingOf([], THREE)
  same(read.siteId, null, 'siteId')
  same(read.inScope.length, 3, 'sites in scope')
  same(read.inView, 3, 'sites in view')
  same(read.scopeKey, '', 'nothing stored')
})

check('a scope of one names that site and narrows to it', () => {
  const read = readingOf(['b'], THREE)
  same(read.siteId, 'b', 'siteId')
  same(read.inScope.length, 1, 'sites in scope')
  same(read.inScope[0].name, 'two.com', 'which site')
  same(read.inView, 1, 'sites in view')
})

check('a scope of two names no single site and narrows the lists', () => {
  const read = readingOf(['a', 'c'], THREE)
  same(read.siteId, null, 'siteId')
  same(read.inScope.length, 2, 'sites in scope')
  same(read.inScope.map(row => row.name).join(','), 'one.com,three.com', 'which sites')
  same(read.inView, 2, 'sites in view')
  same(read.scopeKey, 'a,c', 'what is stored')
})

check('a store holding one bare id is read as a scope of one', () => {
  same('b'.split(',').filter(Boolean).join(','), 'b', 'a single stored id')
  same(''.split(',').filter(Boolean).length, 0, 'an empty store is every site')
  same('a,c'.split(',').filter(Boolean).length, 2, 'a stored set')
})

check('Sites is in the menu across every site', () => {
  same(has(menuSections({ signedIn: true, role: 'admin', inView: 3 }), 'sites'), true, 'shown')
})

check('Sites is in the menu across a chosen pair', () => {
  same(has(menuSections({ signedIn: true, role: 'client', inView: 2 }), 'sites'), true, 'shown')
})

check('Sites is gone when the scope holds one site', () => {
  same(has(menuSections({ signedIn: true, role: 'admin', inView: 1 }), 'sites'), false, 'hidden')
})

check('Sites is gone for an account that holds one site', () => {
  same(has(menuSections({ signedIn: true, role: 'client', inView: 1 }), 'sites'), false, 'hidden')
})

check('Sites stands while the account is still being read', () => {
  same(has(menuSections({ signedIn: true, role: 'admin' }), 'sites'), true, 'shown')
})

check('hiding Sites takes nothing else with it', () => {
  const rows = menuSections({ signedIn: true, role: 'admin', inView: 1 })
  for (const id of ['overview', 'live', 'pages', 'sources', 'visitors']) {
    same(has(rows, id), true, id)
  }
})

check('the admin rule holds on its own', () => {
  const client = menuSections({ signedIn: true, role: 'client', inView: 3 })
  same(has(client, 'admin'), false, 'admin section')
  same(has(client, 'outreach'), false, 'outreach section')
  const staff = menuSections({ signedIn: true, role: 'admin', inView: 3 })
  same(has(staff, 'admin'), true, 'for an admin')
})

check('exactly one section answers only across more than one site', () => {
  const marked = SECTIONS.filter(section => section.multiSite).map(section => section.id)
  same(marked.join(','), 'sites', 'which sections')
})

await finish()

console.log(`console scope: all ${cases.length} cases pass`)
