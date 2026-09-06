import { useState } from 'react'
import { portfolioPreviewSrc, portfolioScreenshotServiceUrl } from '@data/portfolio'

// The stage a capture fills, stated on the element as well as on its box so
// the space is held from the markup alone.
const PREVIEW_BOX = { width: 1280, height: 800 }

/**
 * A client site's committed capture. A site whose capture has not been taken
 * falls back to a server-rendered screenshot of the page itself, so what shows
 * is always the real thing.
 *
 * @param {{ project: object, className?: string }} props
 */
export default function PortfolioPreview({ project, className = '' }) {
  const [useFallback, setUseFallback] = useState(false)
  const src = useFallback
    ? portfolioScreenshotServiceUrl(project, 'desktop')
    : portfolioPreviewSrc(project, 'desktop')

  return (
    <img
      src={src}
      alt={`${project.name} website`}
      width={PREVIEW_BOX.width}
      height={PREVIEW_BOX.height}
      loading="lazy"
      decoding="async"
      onError={() => setUseFallback(true)}
      className={`h-full w-full object-cover object-top ${className}`}
    />
  )
}
