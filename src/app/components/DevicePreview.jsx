import { useCallback, useState } from 'react'
import { Globe } from 'lucide-react'
import { MAX_MS } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { portfolioPreviewSrc, portfolioScreenshotServiceUrl } from '@data/portfolio'
import GlareHover from '@reactbits/GlareHover/GlareHover'

/**
 * The browser and phone frames a portfolio entry's captures are shown in.
 * Shared by the portfolio index and the case study pages so both frame a site
 * the same way and read from the same capture path.
 */

// The box each capture occupies, in the ratio its stage holds. Stated on the
// element as well as on the stage so the space is reserved from the markup
// alone, before any stylesheet has been read.
const PREVIEW_BOX = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
}

// Where a capture is looked for, in the order it is tried: the committed WebP
// first, then a live thum.io render of the site itself. Past the end of the
// list the stage stands on its own, so a site whose capture is missing leaves
// an empty screen in the frame rather than the browser's broken-image mark.
const PREVIEW_SOURCES = [portfolioPreviewSrc, portfolioScreenshotServiceUrl]

// The stage keeps the site's own ground behind the image and fades the preview
// in once it arrives.
function PreviewImage({ project, device, priority, stageClassName }) {
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const source = PREVIEW_SOURCES[attempt]
  const box = PREVIEW_BOX[device]

  // A capture that finished before React attached its handlers fired its load
  // event into nothing, and `onLoad` alone can never learn that it did: the
  // image sits decoded, complete and permanently transparent behind an opacity
  // that is waiting for an event already spent. The pages this frame appears on
  // are prerendered, so the fetch starts while the markup is being parsed and
  // every capture at the top of a page wins that race - which is why the effect
  // was two blank frames at the head of the portfolio and correct ones the
  // moment a row loaded late enough to be seen loading.
  //
  // The element itself is the only thing that still holds the answer, so it is
  // read at mount. `complete` with no width is the same race lost on the error
  // side, and it advances to the next source exactly as `onError` would have.
  // The callback is stable and the image is keyed on the source, so the read
  // happens once per source rather than on every render of the row - an inline
  // ref re-runs on each one, and the error branch would then count a single
  // failed capture more than once.
  const readSettledImage = useCallback(node => {
    if (!node || !node.complete) return
    if (node.naturalWidth > 0) setLoaded(true)
    else setAttempt(tried => tried + 1)
  }, [])

  return (
    <div className={`relative overflow-hidden bg-bg ${stageClassName}`}>
      {source && (
        <img
          key={attempt}
          ref={readSettledImage}
          src={source(project, device)}
          alt={`The ${project.name} website on a ${device === 'phone' ? 'phone' : 'desktop'}`}
          width={box.width}
          height={box.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setAttempt(tried => tried + 1)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ease-out-soft ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}

/**
 * @param {object} props
 * @param {object} props.project - Entry from `PORTFOLIO_PROJECTS`.
 * @param {number} [props.index] - Row position, shown as the frame's sheet
 *   number. Omitted where the frame stands alone.
 * @param {boolean} [props.priority] - Loads the capture eagerly.
 */
export function DesktopMockup({ project, index, priority = false }) {
  return (
    <GlareHover
      {...GROUNDS.sheet.attrs}
      width="100%"
      height="100%"
      background="transparent"
      borderColor="transparent"
      borderRadius="var(--device-window)"
      glareColor="var(--shine-sweep)"
      glareOpacity={0.28}
      glareAngle={-40}
      glareSize={260}
      transitionDuration={MAX_MS * 1000}
      // The frame is a picture of a site rather than a way into one, so the
      // pointer stays what it is over the rest of the page.
      className="border-hair-paper device-window !block !cursor-default overflow-hidden border bg-paper shadow-[var(--lift)]"
    >
      <div className="border-hair-paper flex items-center gap-1.5 border-b bg-paper px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[color:var(--ink-ghost)]" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--ink-ghost)]" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--ink-ghost)]" />
        <div className="border-hair-paper text-paper-faint bg-surface-2 ml-3 flex flex-1 items-center gap-1.5 truncate rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.01em]">
          <Globe className="h-3 w-3" strokeWidth={1.75} />
          <span className="truncate">{project.displayUrl}</span>
        </div>
        {index !== undefined && (
          <span className="text-paper-faint section-label-sm hidden sm:inline">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
      </div>
      <PreviewImage
        project={project}
        device="desktop"
        priority={priority}
        stageClassName="aspect-[16/10] w-full"
      />
    </GlareHover>
  )
}

/**
 * @param {object} props
 * @param {object} props.project - Entry from `PORTFOLIO_PROJECTS`.
 * @param {boolean} [props.priority] - Loads the capture eagerly.
 */
export function PhoneMockup({ project, priority = false }) {
  return (
    // The shell stands on the page, so its edge and its lift belong there; the
    // screen inside it is the website, and takes the sheet.
    <div className="border-hair device-shell relative w-[200px] border bg-[color:var(--device-body)] p-[var(--device-bezel)] shadow-[var(--lift)] sm:w-[228px]">
      <div {...GROUNDS.sheet.attrs} className="device-screen relative overflow-hidden bg-bg">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-raised)] flex justify-center pt-1.5">
          <span className="h-4 w-20 rounded-full bg-[color:var(--device-body)]" />
        </div>
        <PreviewImage
          project={project}
          device="phone"
          priority={priority}
          stageClassName="aspect-[390/844] w-full"
        />
      </div>
    </div>
  )
}
