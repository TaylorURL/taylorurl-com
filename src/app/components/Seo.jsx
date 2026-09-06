import { Helmet } from 'react-helmet-async'
import { BRAND_NAME } from '@constants/navigation'
import { ORGANIZATION, SITE_URL } from '@constants/seo'
import { SITE } from '../../../lib/site/current.js'

// The share card, not the logo: a bare mark strands the reader with no context,
// and the platforms that build the card want a 1200x630 raster.
const DEFAULT_IMAGE = `${SITE_URL}${SITE.head.image}`
const DEFAULT_IMAGE_ALT = SITE.head.imageAlt
const DEFAULT_HOME_TITLE = SITE.head.homeTitle
const DEFAULT_DESCRIPTION = SITE.head.description
const TITLE_SUFFIX = ` | ${BRAND_NAME}`

// The company node, on every page rather than on the pages that happen to
// reference it. The studio's equivalent is in `index.html` and therefore in the
// head of all 139 of its pages; a site whose node is published by a view instead
// has to put it in the same place, because the reference and the node it
// resolves to have to reach a crawler in one document. Empty where the node is
// already site-wide, so the studio's head is untouched.
const SITE_NODES = ORGANIZATION ? [ORGANIZATION] : []

// 60 chars is where search results start truncating. The page's own title is
// what a result is matched and clicked on, so the brand suffix is what comes
// off when the pair will not fit, rather than the words the page was written
// to be found for.
function composeTitle(title) {
  if (!title) return DEFAULT_HOME_TITLE
  const composed = `${title}${TITLE_SUFFIX}`
  return composed.length <= 60 ? composed : title
}

function toSchemaArray(schema) {
  if (!schema) return []
  return Array.isArray(schema) ? schema.filter(Boolean) : [schema]
}

/**
 * Every page's head: title, description, canonical, share cards and JSON-LD.
 *
 * `path` is joined onto the canonical origin rather than read from the router,
 * so it has to be root-relative and has to match the route the page is mounted
 * at. A page that passes the wrong one publishes a canonical pointing
 * somewhere else, which is the one mistake here search acts on.
 *
 * `image` and `imageAlt` take absolute URLs because a share card is fetched by
 * a crawler with no page to resolve a relative path against. `schema` takes one
 * node or several; each is emitted as its own script tag.
 */
export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
  image = DEFAULT_IMAGE,
  imageAlt = DEFAULT_IMAGE_ALT,
  ogType = 'website',
  schema,
  noIndex = false,
  article,
}) {
  const fullTitle = composeTitle(title)
  const url = `${SITE_URL}${path}`
  const schemaNodes = [...SITE_NODES, ...toSchemaArray(schema)]

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
      )}
      <link rel="canonical" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={BRAND_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={imageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {article?.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {article?.modifiedTime && (
        <meta property="article:modified_time" content={article.modifiedTime} />
      )}
      {article?.section && <meta property="article:section" content={article.section} />}
      {article?.tags?.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {schemaNodes.map((node, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(node)}
        </script>
      ))}
    </Helmet>
  )
}
