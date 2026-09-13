import { useEffect, useRef } from 'react'

/**
 * Whether the section a feed belongs to is still on the page.
 *
 * Every read and every write a feed makes lands after an await, and by then the
 * reader may have left the section that asked. What arrives for a section that
 * is gone has nowhere to be drawn, and a notice raised for it is a notice about
 * something nobody is looking at any more - so an answer is checked against
 * this before it is written into state or said out loud.
 *
 * @returns {React.MutableRefObject<boolean>}
 */
export function useAlive() {
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  return alive
}
