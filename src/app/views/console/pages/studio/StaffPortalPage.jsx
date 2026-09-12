import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '@hooks/session/useSession'
import { StaffContext } from '@views/staff/lib/context'
import { PortalNav } from '@views/staff/lib/nav'
import CallDesk from '@views/staff/parts/CallDesk'
import Handbook from '@views/staff/parts/Handbook'
import ShiftBoard from '@views/staff/parts/ShiftBoard'
import '@views/staff/staff.css'
import { useView } from '../../lib/views'
import PortalScreen, { PORTAL_VIEWS } from './PortalScreen'

/**
 * The staff portal, inside the console.
 *
 * This section used to be a table of businesses with a button on it pointing at
 * the portal, which meant the person who works the list and the person who reads
 * it were sent to two different surfaces that drew the same rows two different
 * ways. The list is gone and the portal is here instead: the call screen, the
 * day's figures and the handbook, inside the console frame, under the console's
 * bar and beside its column.
 *
 * Nothing about the screens changed to get them here. Every one of them is the
 * same component the standalone portal at `/staff` renders, handed a different
 * shell - so a line rewritten on the call screen is rewritten in both places,
 * and a screen cannot come to mean one thing to a representative and another to
 * whoever set their shift.
 *
 * What the shell decides is the frame and nothing else. The addresses come from
 * the nav below, because a link reading `/staff/calls` pressed in here would
 * throw the reader out of the console, out of the scope they had set, and onto
 * a surface that looks nothing like the one they pressed from.
 *
 * The section is the admin's. A representative works the portal on its own, one
 * viewport tall with a handset in the other hand, which is what `/staff` is for
 * and why it still exists; the console's copy is for the person who set the
 * shift and wants the portal beside everything else they read. The endpoints
 * behind both answer by role on every request, so neither door is what keeps a
 * figure back.
 */

/** Which surface each view draws. */
const SCREENS = {
  calls: CallDesk,
  management: ShiftBoard,
  resources: Handbook,
}

const SURFACE_KEYS = Object.freeze(PORTAL_VIEWS.map(one => one.key))

export default function StaffPortalPage() {
  const { session } = useSession()
  const [view] = useView(PORTAL_VIEWS)
  const [params] = useSearchParams()

  const token = session?.access_token ?? null
  const userId = session?.user?.id ?? null
  // The name the script says out loud and the figures are greeted by. Settings
  // writes it to the account itself as well as to the profile row, so the
  // session already carries it and nothing here has to read a row for it.
  const name = session?.user?.user_metadata?.full_name ?? null

  // Signing out belongs to the console's account panel, at the head of the
  // column, which is where a reader looks for what belongs to the account. A
  // second way out drawn on the portal front would be one door in two places.
  const staff = useMemo(() => ({ token, userId, name, signOut: null }), [token, userId, name])

  const openedOn = params.get('on')
  const nav = useMemo(
    () => ({
      surfaces: SURFACE_KEYS,
      // Built from nothing rather than from the parameters standing, so moving
      // between surfaces drops whatever the last one was opened on.
      hrefFor: (key, extra) => {
        const search = new URLSearchParams()
        if (key !== PORTAL_VIEWS[0].key) search.set('view', key)
        for (const [held, value] of Object.entries(extra ?? {})) {
          if (value) search.set(held, String(value))
        }
        const query = search.toString()
        return query ? `/console/staff?${query}` : '/console/staff'
      },
      openedOn: openedOn || null,
      // The shift is set here, by the person who decides what a day on the phone
      // comes to.
      sets: true,
    }),
    [openedOn]
  )

  const Screen = SCREENS[view] ?? CallDesk

  return (
    <StaffContext.Provider value={staff}>
      <PortalNav.Provider value={nav}>
        <Screen Shell={PortalScreen} />
      </PortalNav.Provider>
    </StaffContext.Provider>
  )
}
