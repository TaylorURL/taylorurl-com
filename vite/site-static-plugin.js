import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { SITE } from '../lib/site/current.js'

/**
 * What `public/` delivers, corrected for whichever site is being built.
 *
 * `public/` is copied into the build wholesale. Nothing in it is compiled, so
 * nothing in it knew which of the two deployments it had landed in, and the two
 * failures that follow are the two this file answers.
 *
 * The first is a document describing the wrong site. `robots.txt` named the
 * studio's sitemap - a cross-host directive crawlers ignore, so taylor.website's
 * own correct sitemap was never announced at all - and named five paths that
 * site does not serve. `site.webmanifest` called an installed shortcut from
 * taylor.website "TaylorURL LLC" and described it as a web-design studio in
 * Baytown.
 *
 * The second is a file that should not be on the domain at all. Fourteen client
 * screenshots, twenty-six more under `portfolio/email`, fifteen client favicons,
 * five client logos, twelve cards drawn for the studio's own channels, the board
 * shots the studio's home page runs - and a BBB accreditation badge, on a domain
 * that publishes no accreditation. Nothing links to any of it there, which is
 * not the same as it being private: the addresses are the studio's own with the
 * host swapped, so anybody reading one page's markup can read them off it.
 *
 * A transform rather than a file per site, and it is the same argument
 * `site-head-plugin.js` makes about `index.html`. Two copies of a document that
 * is nine tenths identical is two places to change a crawler directive, and the
 * copy that was not changed is the one nobody opens: robots.txt is read by
 * machines, so a stale line in it produces no symptom a person sees. One source
 * with the differing values named in it can only be edited in one place.
 *
 * Same vocabulary as the head plugin, so it is learned once: `%SITE_X%` for a
 * scalar, `site:flag` fences for a region one site claims and the other does
 * not. The markers are spelled in each file's own comment syntax rather than in
 * HTML comments, which is why this is a second implementation and not a call
 * into `withSiteHead` - a `<!--site:console-->` line in robots.txt is a line a
 * crawler has to be trusted to ignore. JSON has no comment syntax at all, so the
 * manifest gets tokens and no fences; every field in it is one both sites answer.
 *
 * The share card takes neither. An image cannot be filled in, so the per-site
 * fact is which file to point at, and `SITE.head.image` already carries it into
 * every page's og:image. Same rule underneath all three: the registry holds what
 * differs, and the build applies it.
 *
 * The cost is that the files in `public/` are templates, so `vite dev` serves a
 * robots.txt with a token where the sitemap's origin goes. Nothing crawls a dev
 * server, and the alternative - substituting the studio's own origin and paths
 * rather than naming them as fields - would make the second site's output a
 * find-and-replace over the first site's, which is the arrangement that produced
 * the fault in the first place.
 */

/** `%SITE_X%`, filled from the record. */
const TOKEN = /%SITE_([A-Z_]+)%/g

/**
 * What each token resolves to, held here rather than read off the record by name
 * so a token cannot reach a field that was never meant for a public document.
 */
const values = site => ({
  ORIGIN: site.origin,
  BRAND: site.brandName,
  SHORT_NAME: site.shortName,
  INSTALL_DESCRIPTION: site.installDescription,
})

/**
 * `# site:flag` … `# /site:flag`, kept or cut by the record's flag.
 *
 * The marker lines go either way, so a site that claims the region ships exactly
 * what is between them and a robots.txt with a comment in it is never served.
 */
const FENCE = /[ \t]*# site:([a-zA-Z]+)\n([\s\S]*?)[ \t]*# \/site:\1\n/g

const STRAY = /^[ \t]*# \/?site:[a-zA-Z]+$/m

/**
 * One document, filled in for one site.
 *
 * Both failures it refuses are ones that ship silently. A literal `%SITE_ORIGIN%`
 * in a Sitemap directive is a line a crawler drops without telling anybody, and a
 * misspelled fence marker means the region it opened was never recognised as a
 * region, so its content is still in the file and being published unconditionally.
 *
 * @param {string} text The file as it sits in `public/`.
 * @param {string} name Which file, for the error message.
 * @param {object} site The resolved record.
 * @param {boolean} fenced Whether this file's syntax can carry fence markers.
 * @returns {string}
 */
export function withSiteValues(text, name, site = SITE, fenced = true) {
  const table = values(site)

  const cut = fenced ? text.replace(FENCE, (whole, flag, body) => (site[flag] ? body : '')) : text

  const stray = cut.match(STRAY)
  if (stray) {
    throw new Error(
      `site-static: unmatched fence marker "${stray[0].trim()}" in ${name} — ` +
        'the region it opens is being published unconditionally'
    )
  }

  return cut.replace(TOKEN, (whole, token) => {
    const value = table[token]
    if (value === undefined || value === null) {
      throw new Error(`site-static: ${whole} has no value for site "${site.key}" in ${name}`)
    }
    return String(value)
  })
}

/** The files this fills in, and whether their syntax can carry a fence. */
const DOCUMENTS = [
  ['robots.txt', true],
  ['site.webmanifest', false],
]

/**
 * What each site does not serve, as paths under `public/`.
 *
 * Written here rather than in the registry because it is a fact about this
 * directory rather than about either site: the records say what a site is, and
 * a record that had to be edited every time a folder of screenshots was renamed
 * would be answering a question it was not asked.
 *
 * Named per site rather than filtered by a rule, for the reason
 * `lib/site/routes/taylorwebsite.js` gives about its own list: a rule fails
 * quietly, and the folder somebody adds next year would pass through it and be
 * published on both domains with nobody told. A key with no entry throws rather
 * than pruning nothing, because a third site silently serving both of these
 * sites' client work is the failure this exists to prevent.
 *
 * `images/email` and `trenton-taylor-email.jpg` are here because the mail
 * modules address them at `https://www.taylorurl.com` outright - the studio is
 * the only deployment that sends - so a copy on the other host is one nothing
 * can reach. The studio's own list holds only the second site's share card,
 * which is a picture of an offer it does not sell.
 */
const NOT_SERVED = {
  taylorurl: ['og-taylorwebsite.png'],
  taylorwebsite: [
    'portfolio',
    'site-icons',
    'social',
    'home',
    'images/reviews',
    'images/email',
    'images/bbb-accredited-business.png',
    'images/trenton-taylor-email.jpg',
    'og.png',
  ],
}

/**
 * Nothing this build renders points at anything just removed.
 *
 * A dead `href` is already caught by `check-internal-links`, which runs against
 * the same directory afterwards. This catches the other half: a `src`, a
 * `srcset` or a `url()` naming a file that is no longer there draws a broken
 * image on a page that otherwise renders perfectly, and only on one of the two
 * deployments. Matched where a document actually addresses a file - after a
 * quote, an equals or a `url(` and ending on a delimiter - so `/og.png` is not
 * found inside `/og-taylorwebsite.png` and a build machine's own `/home` in some
 * absolute path is not read as a reference to the folder of that name.
 */
async function refuseReferences(outDir, removed) {
  const names = await readdir(outDir, { recursive: true })
  const pages = names.filter(name => name.endsWith('.html'))
  const addressed = removed.map(path => [
    path,
    new RegExp(`["'(=]/${path.replace(/[.]/g, '\\$&')}(?=["')\\s/]|$)`),
  ])
  const faults = []
  for (const page of pages) {
    const html = await readFile(join(outDir, page), 'utf8')
    for (const [path, pattern] of addressed) {
      if (pattern.test(html)) faults.push(`${page} names /${path}`)
    }
  }
  if (faults.length) {
    throw new Error(
      `site-static: ${SITE.key} renders a reference to a file it does not serve: ${faults.join(', ')}`
    )
  }
}

/**
 * Registered last, and it has to be. The copy out of `public/` happens at
 * `renderStart`, before a chunk is written, so what is read here is the file as
 * it was delivered - but the pages the guard below reads are written by the
 * prerender plugin at `closeBundle`, and a hook that runs before it would be
 * checking a directory with one page in it.
 */
export default function siteStaticPlugin() {
  let outDir = 'dist'
  return {
    name: 'taylorurl-site-static',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      for (const [name, fenced] of DOCUMENTS) {
        const path = join(outDir, name)
        const source = await readFile(path, 'utf8')
        await writeFile(path, withSiteValues(source, name, SITE, fenced), 'utf8')
      }

      const removed = NOT_SERVED[SITE.key]
      if (!removed) {
        throw new Error(`site-static: no site "${SITE.key}" in the list of what each site serves`)
      }
      await refuseReferences(outDir, removed)
      for (const path of removed) {
        await rm(join(outDir, path), { force: true, recursive: true })
      }
    },
  }
}
