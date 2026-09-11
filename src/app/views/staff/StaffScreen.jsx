import { Link } from 'react-router-dom'
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
 * the way back, because the head is where a hand rests.
 *
 * The three parts sit inside a window rather than directly on the surface. On a
 * phone that window is the whole screen and the distinction costs nothing; on a
 * desktop it is a pane standing on a lit field, which is the one thing the
 * bigger screen is actually for - a phone has no room to stand anything on
 * anything, and a surface drawn edge to edge at fifteen hundred pixels is a
 * narrow column of work in the middle of an empty page.
 *
 * The bars are panes of the same material, so the head says how far it is held
 * above the column by what it casts onto it - the one thing it can only know
 * from where the column is. `useSurfaced` writes that to the head directly
 * rather than through a render.
 *
 * The document's head is the frame's, not this one's. It has to be written for a
 * visit that never reaches a screen at all - a crawler, or a direct load before
 * the session is read back - and `lib/heads.js` is where the four of them live.
 *
 * @param {{title: string, back?: {to: string, label: string},
 *   aside?: React.ReactNode, foot?: React.ReactNode,
 *   children: React.ReactNode}} props
 */
export default function StaffScreen({ title, back, aside, foot, children }) {
  const surfaced = useSurfaced()

  return (
    <div className="staff">
      <div className="staff-window">
        <header className="staff-head" ref={surfaced.head} data-surfaced="false">
          <div className="staff-pad staff-head-row">
            <b>{title}</b>
            {aside}
            {back && (
              <Link className="staff-back" to={back.to}>
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
    </div>
  )
}
