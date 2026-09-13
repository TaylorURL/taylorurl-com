import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { normalizePrefs } from '@lib/outreach/prospects/callPrefs.js'
import { BEAT_MS, heldNumbers, settleDesk } from '@lib/outreach/prospects/callPresence.js'

const DESK_PATH = '/api/calls-desk'

/** What a caller is told when the board will not read. */
const NO_DESK = 'The call desk could not be read.'

/** And when a change to their setup will not save. */
const NO_SAVE = 'That setting could not be saved. Try it again.'

/** Where this browser remembers one account's setup between visits. */
const HINT_KEY = 'console.calls.setup'

/**
 * The setup this browser last saw for this account, or nothing.
 *
 * The account is the only authority on how somebody has the list set up, and
 * this does not change that: it is read once, it is replaced the moment the
 * account's own answer lands, and a disagreement is settled in the account's
 * favour. What it buys is the round trip the list used to spend waiting.
 *
 * The list cannot be read until the filters are known, so asking the desk first
 * and the list second made two waits out of what should be one - roughly half
 * the time between opening the tab and seeing a business. With the last known
 * setup in hand both reads start together, and a reader who has opened this
 * console before sees the list about a second sooner.
 *
 * Stored against the account it belongs to, because two people sign in to this
 * console from the same machine and one reading the other's filters would be a
 * list of businesses they do not work. Every access is wrapped, because a
 * private window and a browser set to refuse site data both throw here rather
 * than returning nothing.
 */
function readHint(userId) {
  if (!userId) return null
  try {
    const held = JSON.parse(window.localStorage.getItem(`${HINT_KEY}.${userId}`) || 'null')
    return held ? normalizePrefs(held) : null
  } catch {
    return null
  }
}

/** The same, written back, and never a reason to fail anything. */
function writeHint(userId, prefs) {
  if (!userId || !prefs) return
  try {
    window.localStorage.setItem(`${HINT_KEY}.${userId}`, JSON.stringify(prefs))
  } catch {
    // A browser refusing site data costs the next visit one round trip, which
    // is exactly what it cost before this existed.
  }
}

/**
 * Says this console is here, holds whichever number it is on, and reads back
 * everybody else's.
 *
 * The beat is the whole mechanism. A console that is open says so every twenty
 * seconds, and the row it writes is worth nothing after seventy - so a tab that
 * closed, slept or lost the network gives back the number it was holding
 * without anybody having to notice, and a colleague is never locked out of a
 * business by a browser that died.
 *
 * It goes on beating while the tab is hidden, and only while this console is
 * actually on a call. That is the opposite of the traffic feed next door, and
 * deliberately: a caller who tabs away to look up an address is still on the
 * phone, and dropping their claim because the tab lost focus is the exact
 * double-call this exists to prevent. A console holding nothing goes quiet the
 * moment it is hidden, because a tab left open behind six others is not
 * somebody working the list.
 *
 * The board is only ever the answer the server gave. Liveness is decided there,
 * against one clock, so three consoles draw one board rather than three
 * readings of it.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {object} the board, this account's setup, and the ways to change both
 */
export function useCallDesk({ token, userId, enabled }) {
  const [desk, setDesk] = useState(null)
  const [error, setError] = useState(null)
  // The setup this browser saw last time, read once so the list can be asked
  // for in the same breath as the board rather than after it. It is a head
  // start and never an authority: `desk` replaces it the moment it lands.
  const [hint, setHint] = useState(() => readHint(userId))
  useEffect(() => {
    setHint(readHint(userId))
  }, [userId])
  const toast = useToast()
  const alive = useRef(true)
  // What this console believes it is holding. A ref rather than state, because
  // the beat reads it and would otherwise restart on every claim and release.
  const holding = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /** What a landed answer does to what is on screen, wherever it came from. */
  const land = useCallback(payload => {
    if (!payload?.presence) return
    setDesk(current => settleDesk(current, payload))
    // Only an answer that actually carried a setup rewrites the remembered one.
    if (payload.prefs) writeHint(payload.you, payload.prefs)
    holding.current = payload.presence.find(row => row.user_id === payload.you)?.prospect_id ?? null
  }, [])

  const send = useCallback(
    async (body, { keepalive = false, quiet = false } = {}) => {
      if (!token || !enabled) return null
      try {
        const response = await fetch(DESK_PATH, {
          method: 'POST',
          keepalive,
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!alive.current) return null
        // A refused claim answers with the board as well as the reason, so a
        // console that met one redraws whatever refused it rather than sitting
        // on a lock it was never given.
        land(payload)
        if (!response.ok) {
          const said = faultFromResponse(response, payload, NO_DESK)
          if (!quiet) toast(said, 'error')
          return null
        }
        setError(null)
        return payload
      } catch (cause) {
        if (alive.current && !quiet) setError(faultMessage(cause, NO_DESK))
        return null
      }
    },
    [token, enabled, toast, land]
  )

  // The beat, and the release, both reach the current send without making
  // either of them restart when it is rebuilt.
  const beat = useRef(send)
  useEffect(() => {
    beat.current = send
  }, [send])

  // The first read writes nothing. A console that has only been opened is not
  // yet somebody working the list, and the setup has to land before the list
  // can be drawn from it.
  useEffect(() => {
    if (!token || !enabled) return undefined
    let stop = false
    ;(async () => {
      try {
        const response = await fetch(`${DESK_PATH}?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        })
        const payload = await response.json().catch(() => ({}))
        if (stop || !alive.current) return
        if (!response.ok) {
          setError(faultFromResponse(response, payload, NO_DESK))
          return
        }
        land(payload)
        setError(null)
      } catch (cause) {
        if (!stop && alive.current) setError(faultMessage(cause, NO_DESK))
      }
    })()
    return () => {
      stop = true
    }
  }, [token, enabled, land])

  useEffect(() => {
    if (!token || !enabled) return undefined
    const tick = () => {
      if (document.visibilityState === 'visible' || holding.current) {
        beat.current({}, { quiet: true })
      }
    }
    const timer = setInterval(tick, BEAT_MS)
    const onShow = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [token, enabled])

  // Leaving the page gives back whatever this console was holding, rather than
  // leaving a colleague to wait out the beat's expiry for a call that ended
  // when the tab closed. `keepalive` is what lets a request outlive the
  // document; a beacon cannot carry the session's own header.
  useEffect(() => {
    if (!token || !enabled) return undefined
    const release = () => {
      if (!holding.current) return
      holding.current = null
      beat.current({ on_phone: null }, { keepalive: true, quiet: true })
    }
    window.addEventListener('pagehide', release)
    return () => {
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [token, enabled])

  const takeNumber = useCallback(
    async prospectId => Boolean(await send({ on_phone: prospectId })),
    [send]
  )

  const dropNumber = useCallback(async () => {
    if (!holding.current) return
    await send({ on_phone: null }, { quiet: true })
  }, [send])

  const savePrefs = useCallback(
    async patch => {
      // Drawn from the change before it is written. A checkbox that waits on a
      // round trip to move reads as a checkbox that did not work.
      setDesk(current =>
        current ? { ...current, prefs: normalizePrefs({ ...current.prefs, ...patch }) } : current
      )
      const saved = await send({ prefs: patch }, { quiet: true })
      if (!saved && alive.current) toast(NO_SAVE, 'error')
      return Boolean(saved)
    },
    [send, toast]
  )

  const presence = useMemo(() => desk?.presence || [], [desk])
  const held = useMemo(() => heldNumbers(presence, new Date()), [presence])

  return {
    // The setup to draw the list from: the account's own the moment it lands,
    // and until then whatever this browser saw last time. Both are a real
    // setup, so the list can be read from either.
    prefs: desk?.prefs ?? hint,
    presence,
    held,
    error,
    // The board is still waiting whatever the hint says. A hint carries a
    // setup and nothing about who is on a call, and "nobody is on a call"
    // drawn from a guess is the one sentence that would make somebody dial.
    loading: !desk && !error,
    takeNumber,
    dropNumber,
    savePrefs,
  }
}
