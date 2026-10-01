import { useCallback, useState } from 'react'
import { retryImage, RETRY_ATTEMPTS } from '@utils/retryImage'

/**
 * A capture committed in both palettes, with the ground picking between them.
 *
 * A shot of a page carries the ground it was taken on, so a light capture on a
 * dark plane is a white rectangle in the middle of a dark page. Both palettes
 * are captured for that reason, and the question is only which one the reader
 * is shown.
 *
 * Asking React was the obvious answer and it was the wrong one. Every route is
 * rendered to markup at build time, where there is no reader and no setting,
 * so the served page carries the light shot; hydration adopts that markup and
 * does not patch an attribute it disagrees with, which leaves a reader in dark
 * looking at the light capture with nothing that will ever correct it. Nor does
 * the picker reach it afterwards - the theme hook holds its state per call site,
 * so the control moves its own copy and this one keeps whatever it mounted on.
 *
 * So the pair is drawn in the markup and CSS chooses, off the same `data-theme`
 * the stylesheet's palettes already hang on. That is stamped before the first
 * paint and restamped the moment the picker moves, so the shot is right on
 * arrival, right through hydration, and right on the toggle - none of which
 * depends on a component having rendered. The one that is not showing is
 * `display: none` and lazily loaded, so it never enters a viewport and its
 * bytes are never asked for.
 *
 * @param {string} props.base - the light capture's path, without extension. The
 *   dark one is the same name with `-dark`, and the narrow cuts add the width.
 * @param {number} props.narrow - the width of the narrow cut, in pixels.
 */
export default function PaletteShot({ base, narrow, alt, width, height, sizes, className = '' }) {
  return ['light', 'dark'].map(palette => (
    <Shot
      key={palette}
      palette={palette}
      src={palette === 'dark' ? `${base}-dark` : base}
      narrow={narrow}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
    />
  ))
}

/**
 * One palette's cut of the shot, with somewhere to go when it does not arrive.
 *
 * An `<img>` that fails is finished: the browser fires one `error` event, the box
 * stays empty, and the element never asks again for the life of the document. So
 * a reader who lost one of these to a dropped packet read the whole band with a
 * torn page in it, and had no way back but a reload. Worse, the answer is
 * cacheable - a 404 or a 502 is served the same `Cache-Control` the picture is -
 * so one lost request takes the shot off that reader's home page for the day.
 *
 * `retryImage` is the ladder every other picture the page depends on already
 * climbs: two rungs, at addresses no cache holds an answer for. These were the
 * pictures that did not, and being lazy and side by side they go out together,
 * which is why a single bad moment on a first navigation arrives as both of them
 * at once.
 *
 * Each palette holds its own state, because only one of the pair is ever asked
 * for - the other is `display: none` and never enters a viewport - so a loss
 * belongs to the reader's own ground rather than to both.
 *
 * Held to one state apart from the ladder: whether this shot is gone. It leaves
 * the plane rather than standing there torn, which is what `CaptureShot` does
 * with a lost capture one column over, so the three steps agree about what a
 * missing picture looks like. The column still reads without it - the numeral,
 * the stage, the title and the sentence are the step, and the shot is the
 * evidence for it.
 */
function Shot({ palette, src, narrow, alt, width, height, sizes, className }) {
  const [lost, setLost] = useState(false)

  /* Read at mount as well as caught on the event, because every route here is
     rendered to markup at build time: the fetch can start and finish while the
     document is still being parsed, and a failure that landed then fired into no
     handler at all. The attribute is still on the element at that point, which is
     the reporter holding the loss for a recovery nothing ever started, so the
     rung the event would have taken is taken here instead. `CaptureShot` reads
     the same settled image for the same reason. */
  const readSettledImage = useCallback(node => {
    if (!node || !node.complete || node.naturalWidth !== 0) return
    if (node.hasAttribute('data-retry')) retryImage({ currentTarget: node })
    else setLost(true)
  }, [])

  /* An element still holding attempts is recovering and keeps its box; the
     failure that arrives with none left is the one the reader actually met, and
     that is the one the empty plane is for. It is the same question `index.html`
     asks in the capture phase to decide whether to file the fault, so the shot
     gives up at the moment the reporter starts counting. */
  function failed(event) {
    const recovering = Number(event.currentTarget.getAttribute('data-retry') || 0) > 0
    retryImage(event)
    if (!recovering) setLost(true)
  }

  if (lost) return null

  return (
    <img
      ref={readSettledImage}
      data-palette={palette}
      src={`${src}.webp`}
      srcSet={`${src}-${narrow}.webp ${narrow}w, ${src}.webp ${width}w`}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      data-retry={String(RETRY_ATTEMPTS)}
      onError={failed}
      className={`palette-shot ${className}`}
    />
  )
}
