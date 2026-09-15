import { PORTAL_SURFACES } from '@views/staff/lib/nav'
import { ViewNav } from '../../ui'
import { useView } from '../../lib/views'

/**
 * The tabs the portal switches on, which are the portal's own surfaces in the
 * portal's own order.
 *
 * The first carries no parameter, so the plain address of the section is the
 * call center - the same rule every other console section's views follow, and
 * the right default besides, because the call screen is where the day is spent.
 */
export const PORTAL_VIEWS = PORTAL_SURFACES.map(one => ({
  key: one.key,
  label: one.label,
}))

/**
 * One portal surface, standing inside the console frame.
 *
 * The portal's screens are written against a shell rather than against a
 * layout. There were two shells once - this one and a standalone portal at
 * `/staff`, one viewport tall with a head and a tab strip of its own - and the
 * screens were kept free of both so a line rewritten on the call screen was
 * rewritten in both places. The standalone shell is gone and its addresses
 * redirect here, and the indirection is worth keeping for the smaller reason it
 * always also served: a screen that states no address cannot throw a reader out
 * of the frame they pressed from.
 *
 * Three parts, and the middle one is the only one that moves - which is the
 * whole point of the arrangement. The control that ends a call is in the same
 * place on the sixtieth call as on the first.
 *
 * Where the console gives a section the whole height of the work region, which
 * is every width from a desk up, the column scrolls inside this and the foot is
 * the last row of the grid. On anything narrower the console's own region
 * scrolls, this flows into it, and the foot sticks to the bottom of the window
 * instead.
 *
 * There is no title here and no way back. The tab row names the screen and the
 * console's bar names the section above it, so a heading would be the third
 * statement of where the reader is; and there is no front to go back to,
 * because every screen is a tab and the tab row is on screen at every width.
 *
 * @param {{aside?: React.ReactNode, foot?: React.ReactNode,
 *   layout?: 'wide' | 'reading', children: React.ReactNode}} props
 */
export default function PortalScreen({ aside, foot, layout = 'wide', children }) {
  const [view, go] = useView(PORTAL_VIEWS)

  return (
    <div className="staff" data-layout={layout}>
      <header className="staff-head">
        <div className="staff-nav">
          <ViewNav
            views={PORTAL_VIEWS}
            current={view}
            // What a screen was opened on belongs to that screen alone, so it is
            // dropped on the way to any other. The business carried across, a
            // caller who opened the handbook mid-call would come back to the
            // call screen holding somebody they had finished with; the span the
            // team board was read over carried across, they would come back to
            // a board answering a question they asked on a different screen.
            onPick={key => go(key, { on: null, range: null })}
            label="Portal Screens"
          />
          {aside}
        </div>
      </header>

      <div className="staff-scroll">
        <div className="staff-stack">{children}</div>
      </div>

      {foot && (
        <footer className="staff-foot">
          <div className="staff-foot-stack">{foot}</div>
        </footer>
      )}
    </div>
  )
}
