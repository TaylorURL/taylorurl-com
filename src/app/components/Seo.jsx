import { Helmet } from 'react-helmet-async'
import { BRAND_NAME } from '@constants/navigation'

const BASE_URL = 'https://taylorurl.com'
const DEFAULT_DESCRIPTION =
  'Professional web development for Houston-area businesses. Custom websites, React applications, and ongoing maintenance from TaylorURL.'

export default function Seo({ title, description = DEFAULT_DESCRIPTION, path = '' }) {
  const fullTitle = title ? `${title} | ${BRAND_NAME}` : `${BRAND_NAME} - Web Development for Local Businesses`
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
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  )
}
