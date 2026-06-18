/**
 * Local-SEO constants reused by view components and JSON-LD payloads.
 *
 * `SITE_URL` is the canonical origin (no trailing slash). `SERVICE_AREAS` is the
 * authoritative list of cities the business names as primary local markets —
 * keep it in sync with the LocalBusiness schema in `index.html` and the footer
 * "Serving" line in `Footer.jsx`.
 */
export const SITE_URL = 'https://taylorurl.com'
export const BUSINESS_ID = `${SITE_URL}/#business`

export const SERVICE_AREAS = [
  'Baytown',
  'Highlands',
  'Mont Belvieu',
  'Channelview',
  'Crosby',
  'La Porte',
  'Deer Park',
  'Pasadena',
  'East Houston',
  'Houston',
]

/**
 * Build a BreadcrumbList JSON-LD node from an ordered crumb list.
 * Each crumb is `{ name, path }`; the final crumb represents the current page.
 */
export function breadcrumbSchema(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  }
}
