import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SITE_URL, SITEMAP_ROUTES } from './site-routes.js'
import { SITE } from '../lib/site/current.js'

const TITLE = SITE.brandName

const SUMMARY = SITE.llmsIntro

const CONTACT = SITE.llmsContact

const PREAMBLE =
  'Every link below is a page the site serves to anyone. Pages behind a sign-in are not ' +
  'listed, and robots.txt disallows them.'

/**
 * The sections of llms.txt, in the order they are laid out, keyed by the
 * `group` every route in the table carries.
 *
 * A sitemap is a set of addresses. This file is read instead of the site, so it
 * is arranged the way the site is: the families a reader would ask for by name,
 * each under a line saying what the family is. The order runs from what the
 * studio is, out through what it sells and who it sells to, and ends on the
 * pages that are published because they have to be rather than to be read.
 *
 * Splitting the article series from the articles is the one division that is
 * not a route family. The series are the shape of the writing and the articles
 * are the writing, and a reader looking for one is not looking for the other.
 */
const STUDIO_SECTIONS = [
  {
    id: 'company',
    heading: 'About TaylorURL',
    line: 'Who TaylorURL is, what it charges, how a project runs, and how to get in touch.',
  },
  {
    id: 'services',
    heading: 'Services',
    line:
      'What TaylorURL sells: a new site, a rebuild of an old one, booking and ordering tools, ' +
      'monthly care, business email, and getting found on Google. Each has a page of its own.',
  },
  {
    id: 'industries',
    heading: 'Industries',
    line:
      'One page per trade, naming what a website has to do for that trade and the software the ' +
      'trade already runs.',
  },
  {
    id: 'areas',
    heading: 'Service Areas',
    line:
      'One page per town, naming the trades that search there and the client sites already ' +
      'built in it.',
  },
  {
    id: 'work',
    heading: 'Client Work',
    line: 'The portfolio index, and a case study for every project that carries one.',
  },
  {
    id: 'tools',
    heading: 'Free Tools',
    line: 'Tools that run in the browser. No account, no fee, and nothing uploaded.',
  },
  {
    id: 'series',
    heading: 'Article Series',
    line: 'The running series the blog is organized into. Each one lists its own articles.',
  },
  { id: 'articles', heading: 'Articles', line: 'Every published article, newest first.' },
  {
    id: 'standing',
    heading: 'Standing Pages',
    line: 'Uptime, privacy, and terms.',
  },
]

/**
 * The sections for whichever site is building.
 *
 * Both the headings and the sentence under each one name what that site
 * actually publishes, so they belong to the site rather than to this plugin. The
 * empty-section refusal below then means the same thing for both: a section this
 * site declared, that no page reached.
 */
const SECTIONS = SITE.llmsSections ?? STUDIO_SECTIONS

const KNOWN_GROUPS = new Set(SECTIONS.map(section => section.id))

function entryLine({ path, name, summary }) {
  const link = `- [${name}](${SITE_URL}${path})`
  return summary ? `${link}: ${summary}` : link
}

/**
 * llms.txt for a set of routes.
 *
 * Every route is placed or the build stops. A page reachable on the site and
 * missing from this file is the failure the file exists to prevent, and a route
 * family added to the table with a group no section claims would otherwise
 * vanish from the guide while the sitemap kept growing.
 *
 * @param {Array<object>} routes Every published route, each carrying `path`,
 *   `name`, `summary` and `group`.
 * @returns {string} The file, ending in a newline.
 */
export function llmsText(routes) {
  const placed = new Map(SECTIONS.map(section => [section.id, []]))
  const seen = new Set()

  for (const route of routes) {
    if (!route.name) throw new Error(`llms.txt: ${route.path} is routed under no name`)
    if (!KNOWN_GROUPS.has(route.group)) {
      throw new Error(
        `llms.txt: ${route.path} is grouped as "${route.group}", which has no section`
      )
    }
    if (seen.has(route.path)) throw new Error(`llms.txt: ${route.path} is routed twice`)
    seen.add(route.path)
    placed.get(route.group).push(route)
  }

  const empty = SECTIONS.filter(section => placed.get(section.id).length === 0)
  if (empty.length) {
    throw new Error(`llms.txt: no page reached ${empty.map(section => section.heading).join(', ')}`)
  }

  const body = SECTIONS.map(section =>
    [`## ${section.heading}`, '', section.line, '', ...placed.get(section.id).map(entryLine)].join(
      '\n'
    )
  )

  return [`# ${TITLE}`, `> ${SUMMARY}`, CONTACT, PREAMBLE, ...body].join('\n\n') + '\n'
}

/**
 * Writes llms.txt from the same route table the sitemap is built from, so the
 * two can never publish different sites.
 */
export default function llmsPlugin() {
  let outDir = 'dist'
  return {
    name: 'taylorurl-llms',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      const routes = SITEMAP_ROUTES
      await writeFile(join(outDir, 'llms.txt'), llmsText(routes), 'utf8')
    },
  }
}
