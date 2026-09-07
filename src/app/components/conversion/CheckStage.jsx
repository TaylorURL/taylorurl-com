import { useEffect, useRef } from 'react'

/**
 * The two columns a check is run from, and what happens to them once it is.
 *
 * The form and the panel beside it are one flex row rather than two boxes,
 * because the whole move is a handover: the moment a reading starts the form
 * has nothing left to say - every field in it is disabled and the answer is a
 * minute away - and the panel counting the wait out is the only thing on the
 * page worth the width. So the form fades and its column closes, and the panel
 * grows into the space by the same measure at the same moment.
 *
 * All of the motion is in `.check-stage`, which is a stylesheet rule and not a
 * script: the browser eases the widths on its own while the page is busy
 * waiting on Google, and the site's blanket reduced-motion rule stills it with
 * everything else.
 *
 * @param {object} props
 * @param {boolean} props.running Whether the reading is in hand.
 * @param {import('react').ReactNode} props.panel What stands beside the form,
 *   and takes the page once the form is gone.
 * @param {import('react').ReactNode} props.children The form itself.
 */
export default function CheckStage({ running, panel, children }) {
  const shell = useRef(null)
  const inner = useRef(null)

  // Below the breakpoint the pair are stacked, so what closes is the form's
  // height, and a height only eases from a number. `auto` is not one, so the
  // form's own measured height is written here for the stylesheet to travel
  // from - kept current while the form is standing, because a validation line
  // appearing under a field changes it and a stale figure would crop the
  // field rather than the space beneath it.
  //
  // The measuring stops for the length of a reading. The height is collapsing
  // over those frames, and an observer still writing what it sees would be
  // handing the transition a new starting point every frame of its own move.
  //
  // What is watched is the wrapper inside the capped box rather than the box
  // itself. A cap that is holding the box at the height it was measured at is
  // a box whose height cannot change, so an observer on it would never fire
  // again - and a form that grew a line under a field would sit over the panel
  // below it, silently, until the page was reloaded.
  useEffect(() => {
    const node = inner.current
    const box = shell.current
    if (!node || !box || running) return undefined
    const measure = () => box.style.setProperty('--check-form-height', `${node.scrollHeight}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [running])

  return (
    <div className="check-stage" data-running={running ? 'true' : 'false'}>
      {/* Held out of the tab order and off the accessibility tree while it is
          invisible, so a form nobody can see is not still something a screen
          reader walks through on the way to the wait. */}
      <div className="check-stage-form" ref={shell} inert={running}>
        <div ref={inner}>{children}</div>
      </div>
      <div className="check-stage-panel">{panel}</div>
    </div>
  )
}
