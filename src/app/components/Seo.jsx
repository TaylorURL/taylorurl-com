import { Helmet } from 'react-helmet-async'
import { BRAND_NAME } from '@constants/navigation'

const BASE_URL = 'https://taylorurl.com'
const DEFAULT_IMAGE = `${BASE_URL}/images/TaylorURL-Logo.png`
const DEFAULT_IMAGE_ALT = 'TaylorURL — web development in Baytown, TX'
const DEFAULT_HOME_TITLE = 'Web Development in Baytown, TX | TaylorURL'
const DEFAULT_DESCRIPTION =
  'Baytown, TX web developer building modern websites and JavaScript apps for shops, restaurants, trades, and pros across the Houston area.'
const TITLE_SUFFIX = ` | ${BRAND_NAME}`

/**
 * Compose the final <title>. Caps at ~60 chars by trimming the page-specific
 * title first if needed, then falling back to the bare suffix.
 */
function composeTitle(title) {
  if (!title) return DEFAULT_HOME_TITLE
  const composed = `${title}${TITLE_SUFFIX}`
  if (composed.length <= 60) return composed
  const allowance = 60 - TITLE_SUFFIX.length
  return `${title.slice(0, Math.max(0, allowance - 1)).trimEnd()}…${TITLE_SUFFIX}`
}

function toSchemaArray(schema) {
  if (!schema) return []
  return Array.isArray(schema) ? schema.filter(Boolean) : [schema]
}

/**
 * Per-route SEO tags hoisted into <head> at prerender time. Keeps titles ≤60
 * chars and descriptions ≤155, populates Open Graph + Twitter cards, and emits
 * any provided JSON-LD nodes (single object or array).
 *
 * @param {object} props
 * @param {string} [props.title] - Page-specific title (omit on the home page).
 * @param {string} [props.description] - Meta description (≤155 chars).
 * @param {string} [props.path] - Path appended to the canonical origin.
 * @param {string} [props.image] - Absolute URL for OG/Twitter image.
 * @param {string} [props.imageAlt] - Alt text for the social image.
 * @param {'website' | 'article' | 'profile'} [props.ogType] - OG type.
 * @param {object | Array} [props.schema] - JSON-LD node(s) for the page.
 * @param {boolean} [props.noIndex] - When true, emits `robots: noindex,nofollow`.
 * @param {object} [props.article] - Article meta: { publishedTime, modifiedTime, section, tags[] }.
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
  const url = `${BASE_URL}${path}`
  const schemaNodes = toSchemaArray(schema)

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
