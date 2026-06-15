import { Helmet } from 'react-helmet-async'
import { BRAND_NAME } from '@constants/navigation'

const BASE_URL = 'https://taylorurl.com'
const DEFAULT_DESCRIPTION =
  'Modern websites and JavaScript applications for local businesses — built by Trenton Taylor, a solo developer in Baytown, Texas serving shops, restaurants, trades, contractors, and independent professionals across the Houston area. Real code, direct relationship, no template-y agency feel.'

export default function Seo({ title, description = DEFAULT_DESCRIPTION, path = '', schema }) {
  const fullTitle = title
    ? `${title} | ${BRAND_NAME} - Websites for Local Businesses`
    : `${BRAND_NAME} - Modern Websites for Local Businesses in Baytown & Houston`
  const url = `${BASE_URL}${path}`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="TaylorURL" />
      <meta property="og:image" content={`${BASE_URL}/images/TaylorURL-Logo.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
    </Helmet>
  )
}
