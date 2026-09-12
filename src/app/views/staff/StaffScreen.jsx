import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useSurfaced } from './lib/surface'

/**
 * One staff screen: a head that is read, a column that scrolls, a foot that is
 * pressed.
 *
 * Every surface under the portal is built from this rather than each laying out
 * its own three parts, which is what keeps the control that ends a call in the
 * same place on the sixtieth call as on the first. A screen with nothing to
 * press passes no foot and the grid closes over it, so the column runs to the
 * bottom of the window rather than to a rule with empty space under it.
 *
 * The head is never a control that ends anything. It holds where you are and
 * the way back, because the head is where a hand rests. It behaves as the
 * site's own bar does: nothing until the column has scrolled under it, and then
 * the page's ground and a hairline. `useSurfaced` writes that to the head
 * directly rather than through a render.
 *
 * `layout` is the one thing a screen says about its own shape. The portal
 * stands in the middle of a desk's window the way the sign-in form does; the
 * handbook holds the site's reading measure; everything else opens wide enough
 * for the two columns a desk has room for.
 *
 * The document's head is the frame's, not this one's. It has to be written for a
 * visit that never reaches a screen at all - a crawler, or a direct load before
 * the session is read back - and `lib/heads.js` is where the four of them live.
 *
 * @param {{title: string, back?: {to: string, label: string},
 *   aside?: React.ReactNode, foot?: React.ReactNode,
 *   layout?: 'wide' | 'portal' | 'reading',
 *   children: React.ReactNode}} props
 */
export default function StaffScreen({ title, back, aside, foot, layout = 'wide', children }) {
  const surfaced = useSurfaced()

  return (
    <div className="staff" data-layout={layout}>
      <header className="staff-head" ref={surfaced.head} data-surfaced="false">
        <div className="staff-pad staff-head-row">
          <b>{title}</b>
          {aside}
          {back && (
            <Link className="staff-back" to={back.to}>
              <ArrowLeft aria-hidden="true" />
              {back.label}
            </Link>
          )}
        </div>
      </header>
      <div className="staff-scroll" ref={surfaced.scroll}>
        <div className="staff-pad staff-stack">{children}</div>
      </div>
      {foot && (
        <footer className="staff-foot">
          <div className="staff-pad staff-foot-stack">{foot}</div>
        </footer>
      )}
    </div>
  )
}
