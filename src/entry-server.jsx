import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import SessionScope from './app/components/SessionScope'
import Providers from './app/Providers'
import App from './app/App'
import { matchViewKeys } from './app/constants/routes'

const nameOf = filePath => filePath.match(/\/([^/]+)\.jsx$/)[1]

// Eager, not lazy: renderToString cannot await, so a lazy() view would
// render as an empty shell here.
//
// Route views are keyed by file name; the console's sections live a directory
// down and are keyed the way routes.jsx names them - OverviewPage becomes
// ConsoleOverview - so the two lists cannot drift apart by a rename.
const viewEntries = [
  ...Object.entries(import.meta.glob('./app/views/*.jsx', { eager: true })).map(
    ([filePath, module]) => [nameOf(filePath), filePath, module.default]
  ),
  ...Object.entries(import.meta.glob('./app/views/console/pages/*.jsx', { eager: true })).map(
    ([filePath, module]) => [
      `Console${nameOf(filePath).replace(/Page$/, '')}`,
      filePath,
      module.default,
    ]
  ),
]

const views = {
  ...Object.fromEntries(viewEntries.map(([key, , view]) => [key, view])),
  SessionScope,
}

// Source paths, project-relative, keyed the same way. The build matches them
// against the client bundle's chunks to find each route's stylesheets.
const viewSources = Object.fromEntries(
  viewEntries.map(([key, filePath]) => [key, filePath.replace(/^\.\//, 'src/')])
)

/**
 * @param {string} url - Route path to render.
 * @returns {string[]} Project-relative source paths of the views the route
 *   mounts. Everything else on the page comes in through the browser entry, so
 *   its CSS is already in the built template's <head>.
 */
export function viewSourcesFor(url) {
  return matchViewKeys(url)
    .map(key => viewSources[key])
    .filter(Boolean)
}

const ROOT_OPEN_TAG = '<div id="root">'

/**
 * The page as one document. The built template's <head> goes in verbatim so
 * hashed asset tags survive, and the route's own head tags - title,
 * description, canonical, share cards - go in after it, which is what gets
 * crawlers real per-route SEO instead of the shell's.
 *
 * Only the root is rendered through React. The browser adopts the served page
 * from the root down, and React numbers the ids behind `useId` by position in
 * the tree: an <html> with a <head> and a <body> under it is a branch the
 * browser never sees, and every generated id below it comes out different in
 * the markup than in the browser. With no <head> in the tree, React writes the
 * route's hoisted tags ahead of the root, and they are moved into the document
 * head here.
 *
 * A route whose content comes from the database is handed it in `seed`, since
 * an effect never runs here and the file would otherwise be a loading shell
 * with no title, description or structured data in it.
 *
 * @param {string} url - Route path to render (e.g. `/blog/some-slug`).
 * @param {string} headInner - Inner HTML of the built template's <head>.
 * @param {object|null} [seed] - Build-time data for this route.
 * @returns {string} A complete HTML document (without the leading doctype).
 */
export function render(url, headInner, seed = null) {
  const markup = renderToString(
    <div id="root">
      <Providers seed={seed}>
        <StaticRouter location={url}>
          <App views={views} />
        </StaticRouter>
      </Providers>
    </div>
  )
  const rootAt = markup.indexOf(ROOT_OPEN_TAG)
  const hoisted = markup.slice(0, rootAt)
  const root = markup.slice(rootAt)
  return `<html lang="en"><head>${headInner}${hoisted}</head><body>${root}</body></html>`
}
