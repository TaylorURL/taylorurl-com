import { createContext, useContext } from 'react'

/**
 * What every surface under the portal needs and none of them should read twice.
 *
 * The token and the account id are the two things each of the screens asks the
 * same question with, and a screen working them out for itself is a screen that
 * can disagree with the one beside it about who is signed in. The frame reads
 * them once and they come down from there.
 *
 * `role` is the same fact one level up: the console reads it off the overview to
 * decide whether this section opens at all, and the screens read it to decide
 * whether a figure on them is a reading or a control. A second read of the
 * profile row from inside a screen would be a second answer to a question that
 * has already been settled, and the screen would be the one that disagreed.
 */
export const StaffContext = createContext(null)

/**
 * @returns {{token: string|null, userId: string|null, name: string|null,
 *   role: string|null, signOut: (() => Promise<void>)|null}} What the frame read.
 */
export function useStaff() {
  const held = useContext(StaffContext)
  if (!held) throw new Error('useStaff was called outside the staff frame')
  return held
}
