import { Link } from 'react-router-dom'

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
 * The document's head is the frame's, not this one's. It has to be written for a
 * visit that never reaches a screen at all - a crawler, or a direct load before
 * the session is read back - and `lib/heads.js` is where the four of them live.
 *
 * @param {{title: string, back?: {to: string, label: string},
 *   aside?: React.ReactNode, foot?: React.ReactNode,
 *   children: React.ReactNode}} props
 */
export default function StaffScreen({ title, back, aside, foot, children }) {
  return (
    <div className="staff">
      <header className="staff-head">
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
      <div className="staff-scroll">
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
