import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { browserStore } from '@utils/storage'

/**
 * The console as a client sees it, shown to an admin.
 *
 * There is no other way to read the client's console. Every section a client
 * has is drawn from their own account, an admin's account has a different
 * shape, so the console is asked to draw for a client instead.
 *
 * Nothing in this file can reach a real record: it imports nothing that
 * fetches, and the session is still the admin's.
 *
 * It answers one question: is this reader being shown the client's console.
 */

/**
 * The flag, and the prefix every sample record made during a preview is filed
 * under.
 *
 * They are the same string so that leaving sweeps the flag along with
 * everything written while it was on. A record added by a later step of the
 * flow is then cleared by a leave that was written before it existed, which is
 * the only version of this that stays correct as the flow grows.
 */
const FLAG_KEY = 'taylorurl_console_preview'
const PREVIEW_PREFIX = 'taylorurl_console_preview'

/** The address that turns it on, and the one value it answers to. */
const FLAG = 'preview'
const FLAG_ON = 'client'

/**
 * The browser's own store, where there is one.
 *
 * Session storage rather than local, and the difference is the whole safety of
 * the thing. A preview belongs to the tab and the sitting that opened it. An
 * admin who looked at the client's console on Friday and opens the console on
 * Monday to answer a real client's question must not open into a sample build,
 * and a workstation somebody else signs into must not either. Local storage
 * would hold the flag until it was deliberately cleared, and the one state
 * nobody remembers to clear is the one that looks exactly like the state they
 * meant to be in.
 *
 * Per tab rather than per browser for a second reason: the way this is used is
 * one tab holding the real console and another holding the client's, and a
 * store shared between them would put both into whichever state was written
 * last and take that arrangement away.
 *
 * A refused store means the preview cannot be entered at all, which is right: a
 * rehearsal whose answers cannot be written down is one that loses them on the
 * first navigation.
 */
function store() {
  return browserStore('sessionStorage')
}

/** Whether this tab is in a preview. False everywhere there is no store. */
function heldPreview() {
  const held = store()
  if (!held) return false
  try {
    return held.getItem(FLAG_KEY) === 'on'
  } catch {
    return false
  }
}

/** Turns it on for this tab. */
function holdPreview() {
  const held = store()
  if (!held) return
  try {
    held.setItem(FLAG_KEY, 'on')
  } catch {
    // A full or refused store costs the preview and nothing else.
  }
}

/**
 * Turns it off, and takes everything written during it with it.
 *
 * The keys are enumerated rather than named, so a sample record this file has
 * never heard of is still cleared. Anything written while a preview is on
 * belongs under the prefix for exactly this reason.
 */
function dropPreview() {
  const held = store()
  if (!held) return
  try {
    const doomed = []
    for (let at = 0; at < held.length; at += 1) {
      const key = held.key(at)
      if (key && key.startsWith(PREVIEW_PREFIX)) doomed.push(key)
    }
    for (const key of doomed) held.removeItem(key)
  } catch {
    // Nothing to clear, or nothing clearable. Either way the tab holds no
    // preview, because a store that cannot be read never entered one.
  }
}

/**
 * Whether the console is drawing for a client, and the two ways in and out.
 *
 * It takes the role the account actually holds rather than the one being
 * drawn. Keeping those two apart is what makes the whole arrangement safe: the
 * console draws from the second, while the control that offers the preview and
 * the strip that announces it read the first. Collapsed into one value, an
 * admin in a preview would have no way to know they were an admin and no way
 * back out.
 *
 * @param {string|undefined} signedInRole the role on the account, undefined
 *   while the read that answers for it is still out
 * @returns {{preview: boolean, enterPreview: () => void, leavePreview: () => void}}
 */
export function usePreviewClient(signedInRole) {
  const location = useLocation()
  const navigate = useNavigate()
  const [held, setHeld] = useState(heldPreview)

  // The store is the state and the address is a one-shot instruction to write
  // it. The flag is read once, on the first render, and held rather than acted
  // on: the role arrives from a feed a moment after the console mounts, so a
  // flag obeyed immediately would be obeyed before there is anybody to check
  // it against, and a flag re-read every render would come back after it had
  // been spent.
  const asked = useRef(new URLSearchParams(location.search).get(FLAG) === FLAG_ON)

  useEffect(() => {
    if (!asked.current || signedInRole === undefined) return
    asked.current = false
    if (signedInRole === 'admin') {
      holdPreview()
      setHeld(true)
    }
    // Spent either way. A flag left in the address is a second place the answer
    // lives, and it is the copy that gets pasted into a message.
    const params = new URLSearchParams(location.search)
    params.delete(FLAG)
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
  }, [signedInRole, location.pathname, location.search, navigate])

  // A flag that reached an account which is not an admin is dropped rather than
  // left sitting, so a tab handed one does not carry it for the visit. The flag
  // names no project and no account, so there is nothing in it that could
  // address somebody else's build even if it were honoured.
  useEffect(() => {
    if (!held || signedInRole === undefined || signedInRole === 'admin') return
    dropPreview()
    setHeld(false)
  }, [held, signedInRole])

  // On while the role is still out, corrected the moment it lands. The other
  // way round costs an admin the studio's own menu, drawn on a screen meant to
  // hold none of it, for the length of one read on every reload - and the
  // reader that correction would be for, a client holding a hand-written flag,
  // is shown the client console either way.
  const preview = held && (signedInRole === 'admin' || signedInRole === undefined)

  // Entering deliberately does not navigate. The console sends a client with an
  // unfinished build to their questions the instant it reads one, which is
  // exactly the arrival a client gets, and a second navigation here would be a
  // second answer to where a client lands.
  const enterPreview = useCallback(() => {
    holdPreview()
    setHeld(true)
  }, [])

  // Leaving lands on the console rather than standing still. The addresses a
  // preview is usually left from are the two a client has, and an admin has no
  // build behind either, so staying put would hand them the empty reading of a
  // section they did not ask to open.
  const leavePreview = useCallback(() => {
    dropPreview()
    setHeld(false)
    navigate('/console', { replace: true })
  }, [navigate])

  return { preview, enterPreview, leavePreview }
}

/**
 * The business the preview is drawn for. The strip across the top names it, so
 * it is read from here rather than written twice.
 */
export const SAMPLE_BUSINESS = 'Bellview Plumbing'
