import { PORTAL_SURFACES } from '@views/staff/lib/nav'
import { ViewNav } from '../../ui'
import { useView } from '../../lib/views'

/**
 * The tabs the console's portal switches on, which are the portal's own
 * surfaces in the portal's own order, less its front.
 *
 * The first carries no parameter, so the plain address of the section is the
 * call center - the same rule every other console section's views follow.
 */
export const PORTAL_VIEWS = PORTAL_SURFACES.filter(one => one.key !== 'portal').map(one => ({
  key: one.key,
  label: one.label,
}))

/**
 * One portal surface, standing inside the console frame.
 *
 * The portal's screens are written against a shell rather than against a
 * layout, because the same screens are worked from two places: a
 * representative opens them on their own, one viewport tall with nothing else
 * on the screen, and an admin opens them here, under the console's bar and
 * beside its column. This is the second of those two shells, and it answers to
 * the same props as the first.
 *
 * Three parts, and the middle one is the only one that moves - which is the
 * whole point of the arrangement. The control that ends a call is in the same
 * place on the sixtieth call as on the first, and it stays in the same place
 * whether the caller is working the portal on its own or reading it in the
 * console.
 *
 * Where the console gives a section the whole height of the work region, which
 * is every width from a desk up, the column scrolls inside this and the foot is
 * pinned under it. On anything narrower the console's own region scrolls, this
 * flows into it, and the foot sticks to the bottom of the window instead.
 *
 * `title` and `back` are the standalone shell's, and are deliberately dropped
 * here. The tab row names the screen and the console's bar names the section
 * above it, so a heading would be the third statement of where the reader is.
 * There is no front here to go back to: every screen is a tab, and the tab row
 * is on screen at every width.
 *
 * @param {{aside?: React.ReactNode, foot?: React.ReactNode,
 *   layout?: 'wide' | 'portal' | 'reading', children: React.ReactNode}} props
 */
export default function PortalScreen({ aside, foot, layout = 'wide', children }) {
  const [view, go] = useView(PORTAL_VIEWS)

  return (
    <div className="staff" data-mode="console" data-layout={layout}>
      <header className="staff-head">
        <div className="staff-nav">
          <ViewNav
            views={PORTAL_VIEWS}
            current={view}
            // The business a screen was opened on belongs to that screen alone,
            // so it is dropped on the way to any other. Carried across, a caller
            // who opened the handbook mid-call would come back to the call
            // screen holding somebody they had finished with.
            onPick={key => go(key, { on: null })}
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
