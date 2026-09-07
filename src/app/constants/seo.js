/**
 * The local-SEO constants the service pages publish.
 *
 * `SITE_URL` is the canonical origin, with no trailing slash, so a path can be
 * appended to it directly.
 *
 * `SERVICE_AREAS` is the short list of cities the service pages name as primary
 * markets, in the `areaServed` of their JSON-LD as well as on the page. It is a
 * different list from `SERVICE_TOWNS` in `@data/areas`, which is the set of
 * towns the footer names and `/areas` builds a page for. A place belongs here
 * when the work reaches it, and there when it also carries enough of its own to
 * fill a page, so the two overlap without matching.
 */

// Relative, not `@lib`. This module is reached three ways - by the browser
// through Vite, by vite/review-schema-plugin.js from Vite's own config process,
// and by scripts/reviews/check-review-schema.js under bare node with no resolver hooks -
// and an aliased import would resolve for exactly one of them.
import { HAS_LOCAL_SEO, SITE } from '../../../lib/site/current.js'

export const SITE_URL = SITE.origin
export const BUSINESS_ID = `${SITE_URL}/#business`

/**
 * The company, for the site that publishes no local business node.
 *
 * Six views reference `BUSINESS_ID` - as the `provider` of a service, as what an
 * about or a contact page is about, and as the organisation the person on the
 * about page works for. On the studio those resolve to the `LocalBusiness` node
 * in `index.html`. That node sits inside a `site:localSeo` fence and is cut from
 * the site that names no town, so on the subsidiary the six references pointed
 * at an `@id` no document on the site declares: three services with a provider
 * that does not exist, and a person employed by nothing.
 *
 * The references are right and the node was missing, so this publishes the node
 * rather than taking them out. `TaylorURL LLC` is one company and this site is a
 * property of it, so what the references say is true. What is not true here is
 * the local half of the studio's claim - the locality, the geo circle, the
 * opening hours, the ten towns, and the directory and review profiles the studio
 * is listed on - so this is an `Organization` and carries only what holds on a
 * site with no address and no reviews of its own.
 *
 * Every value is read from the registry rather than written here, so the node,
 * the footer and the head cannot end up describing the same company differently.
 *
 * Null on the studio, which already publishes its own node site-wide from
 * `index.html`; a second one under the same `@id` would be two documents
 * describing one business. `Seo` puts this in the head of every page the
 * subsidiary builds, which is where the studio's equivalent already is.
 *
 * Asked as `HAS_LOCAL_SEO` for the reason `SERVICE_AREAS` below is: the constant
 * folds to a literal, so the node is dropped from the bundle of the site that
 * must not carry it, where a read of `SITE.localSeo` would ship both answers.
 */
export const ORGANIZATION = HAS_LOCAL_SEO
  ? null
  : {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': BUSINESS_ID,
      name: SITE.brandName,
      legalName: SITE.brandName,
      description: SITE.head.description,
      url: SITE_URL,
      logo: `${SITE_URL}/images/TaylorURL-Logo.png`,
      image: `${SITE_URL}${SITE.head.image}`,
      email: SITE.supportEmail,
      // The digits a dial takes, which is the form the studio's node states and
      // the form a directory is matched against.
      telephone: SITE.phoneHref.replace(/^tel:/, ''),
    }

const STUDIO_SERVICE_AREAS = [
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
 * The markets a service page names, and the same list in the shape a JSON-LD
 * `areaServed` takes, built once here rather than in every page that publishes
 * a service.
 *
 * Empty for a site with no locality, and `areaServed` is undefined rather than
 * an empty array there, because `JSON.stringify` drops an undefined property and
 * keeps an empty one. A service node publishing `"areaServed": []` is making a
 * claim - that the work reaches nowhere - and six views emit this without
 * knowing which site they are rendering for.
 *
 * Asked as `HAS_LOCAL_SEO` rather than as `SITE.localSeo`, which is the same
 * question. The constant compares against the key Vite substitutes as a literal,
 * so the branch folds and the losing side is dropped from the bundle;
 * `SITE.localSeo` is a property read of an object the bundler cannot see
 * through, so both branches survive and the ten town names travelled to a domain
 * that names no town. They were not rendered there - they sat in the main chunk
 * every visitor downloads, which is a thing a crawler and a competitor can both
 * read. `check-site-key.js` asserts the constant against the record's own field
 * under both keys, so the two forms cannot drift apart.
 */
export const SERVICE_AREAS = HAS_LOCAL_SEO ? STUDIO_SERVICE_AREAS : []

export const AREA_SERVED = HAS_LOCAL_SEO
  ? STUDIO_SERVICE_AREAS.map(name => ({
      '@type': 'City',
      name,
      containedInPlace: { '@type': 'State', name: 'Texas' },
    }))
  : undefined

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
