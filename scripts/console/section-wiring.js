/**
 * What a console section has to be wired into, asked the same way for every
 * section a check is written for.
 *
 * The four files a section is registered in, the shape of its entry in the
 * menu and the door its endpoint answers at are the same for every section, and
 * a check that lists them for itself goes on listing four when a fifth arrives.
 * So they are named here once, and each section's check says only which
 * section it means.
 */
import { same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const SECTIONS = 'src/app/views/console/lib/sections.js'

/**
 * Every file that does not register a section, as a fault naming it. `id` is
 * the section's address under /console, `key` the name its route and its
 * loader share, and `called` how a fault names it.
 */
export function unregistered({ id, key, called }) {
  const places = [
    [SECTIONS, `id: '${id}'`],
    ['src/app/constants/routes.js', `key: '${key}', path: '${id}'`],
    ['src/app/views.js', `${key}:`],
    ['vite/site-routes.js', `'/console/${id}'`],
  ]
  return places
    .filter(([path, needle]) => !read(path).includes(needle))
    .map(([path]) => `${path} does not carry the ${called} section`)
}

/** A section's entry in the menu, from its id to the close of its object. */
export function sectionEntry(id) {
  const sections = read(SECTIONS)
  const entry = sections.slice(sections.indexOf(`id: '${id}'`))
  return entry.slice(0, entry.indexOf('},'))
}

/** Ends a case unless the endpoint at `path` lets in the admin role and never a bare session. */
export function asksForAdmin(path) {
  const endpoint = read(path)
  same(endpoint.includes('authorizeAdmin'), true, 'authorizeAdmin is the door')
  same(
    /authorizeAccount\s*\(/.test(endpoint),
    false,
    'no plain session check stands in for the role check'
  )
}
