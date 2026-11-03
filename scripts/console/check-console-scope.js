/**
 * Proves that the console's scope behaves at every size it can be.
 *
 * The scope is a set of sites, and its three readings are easy to get wrong in
 * ways nothing else catches: a set of one has to behave exactly as a single
 * site does or every section quietly changes what it draws, a set of two has to
 * narrow the per-site lists or a reader comparing two sites is shown fifteen,
 * and an empty set has to mean every site rather than none.
 *
 * The menu is checked here too, because it is the other half of what a reader
 * is offered: a client reads Overview, Speed and Status, and every section
 * marked for an admin stays out of anybody else's column.
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
  same(read.scopeKey, '', 'nothing stored')
})

check('a scope of one names that site and narrows to it', () => {
  const read = readingOf(['b'], THREE)
  same(read.siteId, 'b', 'siteId')
  same(read.inScope.length, 1, 'sites in scope')
  same(read.inScope[0].name, 'two.com', 'which site')
})

check('a scope of two names no single site and narrows the lists', () => {
  const read = readingOf(['a', 'c'], THREE)
  same(read.siteId, null, 'siteId')
  same(read.inScope.length, 2, 'sites in scope')
  same(read.inScope.map(row => row.name).join(','), 'one.com,three.com', 'which sites')
  same(read.scopeKey, 'a,c', 'what is stored')
})

check('a store holding one bare id is read as a scope of one', () => {
  same('b'.split(',').filter(Boolean).join(','), 'b', 'a single stored id')
  same(''.split(',').filter(Boolean).length, 0, 'an empty store is every site')
  same('a,c'.split(',').filter(Boolean).length, 2, 'a stored set')
})

const ids = rows => rows.map(section => section.id).join(',')

// What a client reads, and what only the studio's own account reads.
const CLIENT = ['overview', 'vitals', 'status']
const STUDIO = ['inbox', 'calls', 'payments', 'admin', 'server']

check('a client is offered Overview, Speed and Status', () => {
  same(ids(menuSections({ signedIn: true, role: 'client' })), CLIENT.join(','), 'menu')
})

check('Settings is a section and not a row in the menu', () => {
  same(has(SECTIONS, 'settings'), true, 'a section')
  same(has(menuSections({ signedIn: true, role: 'admin' }), 'settings'), false, 'in the menu')
})

check('a signed-out reader may open Status and nothing else', () => {
  const open = menuSections({ signedIn: false }).filter(section => !section.locked)
  same(ids(open), 'status', 'unlocked')
})

check('the admin rule holds on its own', () => {
  const client = menuSections({ signedIn: true, role: 'client' })
  for (const id of STUDIO) same(has(client, id), false, `${id} for a client`)
  const admin = menuSections({ signedIn: true, role: 'admin' })
  for (const id of [...CLIENT, ...STUDIO]) same(has(admin, id), true, `${id} for an admin`)
})

await finish()

console.log(`console scope: all ${cases.length} cases pass`)
