import { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import Seo from '@components/Seo'
import Waiting from '@components/app-shell/Waiting'
import { useDeferredWait } from '@hooks/chrome/useDeferredWait'
import { useSession } from '@hooks/session/useSession'
import { supabase } from '@data/supabase/supabaseClient'
import { StaffContext } from './lib/context'
import { PortalNav, STANDALONE } from './lib/nav'
import { headFor } from './lib/heads'
import './staff.css'

/**
 * The ground the four staff surfaces sit on, and the gate in front of them.
 *
 * The gate is a session and nothing more. Whether an account may read the call
 * list is decided by the endpoints, on every request, against the role on the
 * profile - so a second opinion here could only ever be a weaker copy of that
 * one, and a weaker copy that disagrees is how a screen opens on a list it
 * cannot read. What this decides is the one thing the server cannot: where to
 * send somebody who is not signed in at all, and how to get them back.
 *
 * `from` carries the address they were heading for, so a representative who
 * opens the call screen off a phone's home screen and is asked to sign in lands
 * on the call screen rather than on the portal.
 */
export default function StaffFrame() {
  const { session, checking, signOut } = useSession()
  const location = useLocation()
  const [params] = useSearchParams()
  const [name, setName] = useState(null)
  const token = session?.access_token ?? null
  const userId = session?.user?.id ?? null
  const wait = useDeferredWait(checking)
  // The head belongs to the address rather than to the session, so it is written
  // whoever is asking. A prerendered page is written with nothing read back at
  // all, which is the one visit that decides whether a crawler is told to leave
  // this family alone.
  const head = headFor(location.pathname)

  // The name the portal greets somebody by. It is one row read once for the
  // whole surface, and its absence is not a fault: an account with no profile
  // row is greeted by the portal's own name instead, which is what the screen
  // says before this lands anyway.
  useEffect(() => {
    if (!userId) {
      setName(null)
      return undefined
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setName(data?.full_name?.trim() || null)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const held = useMemo(() => ({ token, userId, name, signOut }), [token, userId, name, signOut])

  // The business a screen was opened on, where one was named. Only the call
  // screen reads it, and the address is the address, so a link pasted into a
  // phone opens on the business it names.
  const opened = params.get('on')
  const nav = useMemo(() => ({ ...STANDALONE, openedOn: opened || null }), [opened])

  if (checking) {
    return (
      <div className="staff">
        <Seo title={head.title} description={head.description} path={location.pathname} noIndex />
        <Waiting visible={wait.visible} label="Reading your account" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return (
    <StaffContext.Provider value={held}>
      <PortalNav.Provider value={nav}>
        <Seo title={head.title} description={head.description} path={location.pathname} noIndex />
        <Outlet />
      </PortalNav.Provider>
    </StaffContext.Provider>
  )
}
