import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '@hooks/session/useSession'
import { StaffContext } from '@views/staff/lib/context'
import { PortalNav } from '@views/staff/lib/nav'
import CallDesk from '@views/staff/parts/CallDesk'
import Handbook from '@views/staff/parts/Handbook'
import ShiftBoard from '@views/staff/parts/ShiftBoard'
import '@views/staff/staff.css'
import { useConsole } from '../../lib/context'
import { useView } from '../../lib/views'
import PortalScreen, { PORTAL_VIEWS } from './PortalScreen'

/**
 * The staff portal.
 *
 * This section used to be a table of businesses with a button on it pointing at
 * a portal of its own, which meant the person who works the list and the person
 * who reads it were sent to two different surfaces that drew the same rows two
 * different ways. The list is gone and the portal is here instead: the call
 * screen, the day's figures and the handbook, inside the console frame, under
 * the console's bar and beside its column.
 *
 * It is the only place the portal is. There was a second one - `/staff`, a
 * standalone shell built for a representative working with a handset in the
 * other hand - and keeping it meant two shells, two heads, two sets of
 * navigation and two answers to the question of where a screen is opened from,
 * for one set of screens. What it was actually for is a console that works on a
 * phone, and the console works on a phone: its own bar, a strip of section
 * pills, and this section's tab row under them. So the shell went and its four
 * addresses redirect in here.
 *
 * What the shell decides is the frame and nothing else. The addresses come from
 * the nav below, because a link reading `/staff/calls` pressed in here would
 * throw the reader out of the console, out of the scope they had set, and onto
 * a surface that no longer exists.
 *
 * Who may open it is two roles rather than one. An admin reads the board and
 * sets what a day comes to; a representative works the call screen and reads
 * the figures they are measured against. The endpoints behind both answer by
 * role on every request, so the line drawn here is about what is worth drawing
 * rather than about what is kept back.
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
  const { role } = useConsole()
  const [view] = useView(PORTAL_VIEWS)
  const [params] = useSearchParams()

  const token = session?.access_token ?? null
  const userId = session?.user?.id ?? null
  // The name the script says out loud and the figures are greeted by. Settings
  // writes it to the account itself as well as to the profile row, so the
  // session already carries it and nothing here has to read a row for it.
  const name = session?.user?.user_metadata?.full_name ?? null

  // The role is the console's, read once at the frame off the overview and
  // handed down, rather than a second read of the profile from in here. Two
  // reads of one row are two answers that can disagree, and the one that
  // decides whether this section opens at all is the frame's.
  //
  // Signing out belongs to the console's account panel, at the head of the
  // column, which is where a reader looks for what belongs to the account. A
  // second way out drawn on a portal screen would be one door in two places.
  const staff = useMemo(
    () => ({ token, userId, name, role: role ?? null, signOut: null }),
    [token, userId, name, role]
  )

  const openedOn = params.get('on')
  const sets = role === 'admin'
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
      // The shift is set by the person who decides what a day on the phone
      // comes to, which is an admin. A representative reads the figures they
      // are worked against and never moves them: a target somebody can lower at
      // four in the afternoon is not a target.
      sets,
    }),
    [openedOn, sets]
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
