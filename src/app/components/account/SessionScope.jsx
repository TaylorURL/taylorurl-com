import { Outlet } from 'react-router-dom'
import { SessionContext, useSessionState } from '@hooks/session/useSession'

/**
 * Holds the account for the routes that need one.
 *
 * One copy, because the answer takes two round trips to reach and every page
 * working it out separately spends that time disagreeing with the others. Two
 * guards reading two half-finished copies is what sends a sign-in round between
 * the console and the login form.
 *
 * It sits on those routes rather than over the whole site so that the auth
 * client stays out of the marketing pages, where it would be about 58kB gzipped
 * spent on a question nobody there asks.
 */
export default function SessionScope() {
  const value = useSessionState()
  return (
    <SessionContext.Provider value={value}>
      <Outlet />
    </SessionContext.Provider>
  )
}
