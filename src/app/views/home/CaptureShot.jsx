import { useCallback, useState } from 'react'
import { portfolioPreviewSrc } from '@data/portfolio'

// The box each capture is laid out in before it arrives.
const BOX = {
  desktop: { width: '1200', height: '750' },
  phone: { width: '390', height: '844' },
}

/**
 * A client's committed capture, standing on a lit plane.
 *
 * A capture that does not arrive leaves the plane, because the browser's own
 * mark for a missing image is a torn page and a line of alt text, and these
 * stand in the middle of the home page's two strongest bands beside the claim
 * that the work is live. A claim can stand on its own; it must never stand
 * beside a broken picture of itself. The frames in `DevicePreview` settle the
 * same failure the same way and draw the same captures at the same addresses,
 * so the two agree about what a lost one looks like.
 *
 * `complete` with no width is read at mount as well as caught on the event. An
 * image that finished before React attached its handlers fired into nothing,
 * and this page is prerendered, so the fetch starts while the markup is being
 * parsed and that race is lost often rather than rarely.
 *
 * @param {object} props
 * @param {object} props.project - The portfolio entry whose capture it is.
 * @param {'desktop' | 'phone'} props.device - Which of its captures.
 * @param {string} props.alt
 * @param {string} props.className
 */
export default function CaptureShot({ project, device, alt, className }) {
  const [lost, setLost] = useState(false)

  const readSettledImage = useCallback(node => {
    if (node && node.complete && node.naturalWidth === 0) setLost(true)
  }, [])

  if (lost) return null

  return (
    <img
      ref={readSettledImage}
      src={portfolioPreviewSrc(project, device)}
      alt={alt}
      width={BOX[device].width}
      height={BOX[device].height}
      loading="lazy"
      decoding="async"
      onError={() => setLost(true)}
      className={className}
    />
  )
}
