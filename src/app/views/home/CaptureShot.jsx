import { useCallback, useState } from 'react'
import { useCaptureLadder } from '@components/mockups/captureLadder'

// The box each capture is laid out in before it arrives.
const BOX = {
  desktop: { width: '1200', height: '750' },
  phone: { width: '390', height: '844' },
}

/**
 * What the frame draws once there is nothing left to ask for.
 *
 * The lettered tile the card frames draw and the console draws for a client
 * whose favicon answers nowhere, in the frame's own shape. This frame is the
 * whole of what its shell holds - the browser chrome and the phone body around
 * it are drawn by the band, and behind the capture there is nothing - so a
 * frame with no picture left to ask for is an empty device unless it draws
 * something, and an empty device on the home page's strongest band reads as the
 * site being broken rather than as a picture being missing.
 *
 * The ratio is stated on the element rather than left to the class list,
 * because the call sites pass the shape as a class on the picture and one of
 * them passes none at all.
 */
function CapturePlate({ project, device, className }) {
  const box = BOX[device]
  return (
    <div
      className={`bg-surface-1 flex flex-col items-center justify-center gap-2 ${className}`}
      style={{ aspectRatio: `${box.width} / ${box.height}` }}
    >
      <span
        aria-hidden="true"
        className="display-4 font-semibold leading-none tracking-tightest text-[color:var(--ink-ghost)]"
      >
        {project.name.trim().charAt(0).toUpperCase()}
      </span>
      <p className="section-label-sm text-ink-faint">{project.displayUrl}</p>
    </div>
  )
}

/**
 * A client's committed capture, standing on a lit plane.
 *
 * The capture is asked for down `captureLadder`, the same ladder the device
 * frames in `DevicePreview` and the flat card frames in `PortfolioPreview`
 * climb: this site's own WebP, twice more at an address no cache holds an
 * answer for, then a live render from the screenshot service, then the plate
 * above. For a long time this frame was the third answer to the question those
 * two had already settled between them - it asked once, marked nothing, and on
 * the one failure it ever waited for it removed the picture from the page.
 *
 * Both halves of that were faults. The rung it asked at carried no
 * `data-retry`, which is the attribute the reporter in the page head reads to
 * tell a failure a reader actually met from one the element is about to ask
 * again for, so a capture lost to a dropped packet filed a fault naming a file
 * that was present and answering - the thing #683 fixed for the device frames
 * and #842 for the cards, arriving here through the one frame neither reached.
 * And a capture that failed left the lit plane empty for the life of the page,
 * which on the home page's two strongest bands is an empty phone body beside
 * the claim that the work is live.
 *
 * A capture that is genuinely gone still reports exactly once, from the last
 * ask at this site's own file, which is where the ladder drops the attribute.
 *
 * @param {object} props
 * @param {object} props.project - The portfolio entry whose capture it is.
 * @param {'desktop' | 'phone'} props.device - Which of its captures.
 * @param {string} props.alt
 * @param {string} props.className
 * @param {boolean} [props.eager] For a capture on the first screen, which the
 *   browser should fetch with the page rather than when it scrolls near.
 */
export default function CaptureShot({ project, device, alt, className, eager = false }) {
  const { attempt, source, loaded, image } = useCaptureLadder(project, device)

  // Whether this frame has met a failure yet. The picture is held transparent
  // from the moment it does, so the browser's own mark for a missing image -
  // a torn page and a line of alt text - is never what a reader sees while the
  // ladder is being climbed behind it.
  //
  // Held rather than read off the attempt because the frame waits 350ms before
  // the second ask, and the mark would stand there for all of it. And it is
  // only ever held from a failure, never from the first ask: these captures are
  // the first screen of a prerendered page, so the markup's own ask has usually
  // finished before any script has run, and a picture that waited for
  // hydration to be made visible would be the band's largest paint waiting on
  // the bundle.
  const [met, setMet] = useState(false)

  // The ladder reads an image that settled before React attached its handlers -
  // which on this page is most of them - and takes the rung the error event
  // would have taken. The same read says whether to hold this one, because that
  // failure's event fired before any handler of ours existed and nothing else
  // will ever mention it.
  const { ref: climb, onError: give } = image
  const readSettledImage = useCallback(
    node => {
      if (node && node.complete && node.naturalWidth === 0) setMet(true)
      climb(node)
    },
    [climb]
  )

  if (!source) return <CapturePlate project={project} device={device} className={className} />

  return (
    <img
      key={attempt}
      {...image}
      ref={readSettledImage}
      onError={event => {
        setMet(true)
        give(event)
      }}
      alt={alt}
      width={BOX[device].width}
      height={BOX[device].height}
      loading={eager ? 'eager' : 'lazy'}
      className={`${loaded || !met ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  )
}
