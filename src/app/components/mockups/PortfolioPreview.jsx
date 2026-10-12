import { useCaptureLadder } from '@components/mockups/captureLadder'

// The stage a capture fills, stated on the element as well as on its box so
// the space is held from the markup alone.
const PREVIEW_BOX = { width: 1280, height: 800 }

/**
 * What the frame draws once there is nothing left to ask for.
 *
 * The lettered tile the console draws for a client whose favicon answers at
 * none of the three conventional paths, in the one other place on this site
 * where a picture of somebody else's property may simply not be available. A
 * frame that has spent its ladder and the screenshot service past it had
 * nothing at all here: the reader was left with the browser's broken-image
 * mark over a hole in the middle of the proof, for the life of the page. #843
 * and #844 were two of those in one page view, on a page whose third frame
 * drew.
 */
function CapturePlate({ project }) {
  return (
    <div className="bg-surface-1 flex h-full w-full flex-col items-center justify-center gap-3">
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
 * A client site's committed capture, in a flat card frame.
 *
 * The capture is asked for down `captureLadder`, the same ladder the device
 * frames climb: this site's own WebP, twice more at an address no cache holds
 * an answer for, then a live render of the page from the screenshot service,
 * then the plate above. A dropped request is therefore asked again rather than
 * lost, the rungs that are still climbing are marked so the reporter can tell a
 * failure a reader met from one the frame is about to fix, and the end of the
 * ladder is something drawn rather than an empty box.
 *
 * The capture fills the box it is put in, and `className` is its whole class
 * list, so a card that animates its capture names that alongside the fill.
 *
 * @param {{ project: object, className?: string }} props
 */
export default function PortfolioPreview({
  project,
  className = 'h-full w-full object-cover object-top',
}) {
  const { attempt, source, loaded, image } = useCaptureLadder(project, 'desktop')

  if (!source) return <CapturePlate project={project} />

  return (
    <img
      key={attempt}
      {...image}
      alt={`${project.name} website`}
      width={PREVIEW_BOX.width}
      height={PREVIEW_BOX.height}
      loading="lazy"
      // Held transparent until the picture is actually on the screen, so the
      // frame shows its own ground while the ladder is being climbed rather
      // than the browser's broken-image mark. No transition is named: the
      // frames that animate their capture on a pointer name
      // `transition-transform` in the class list they pass, and two utilities
      // for one property is one of them losing.
      className={`${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  )
}
