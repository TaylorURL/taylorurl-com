import { createContext, useContext } from 'react'

/**
 * What every surface under the portal needs and none of them should read twice.
 *
 * The token and the account id are the two things each of the four screens asks
 * the same question with, and a screen working them out for itself is a screen
 * that can disagree with the one beside it about who is signed in. The frame
 * reads them once and they come down from there.
 */
export const StaffContext = createContext(null)

/**
 * @returns {{token: string|null, userId: string|null, name: string|null,
 *   signOut: () => Promise<void>}} What the frame read.
 */
export function useStaff() {
  const held = useContext(StaffContext)
  if (!held) throw new Error('useStaff was called outside the staff frame')
  return held
}
