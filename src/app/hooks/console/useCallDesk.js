import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { normalizePrefs } from '@lib/outreach/prospects/callPrefs.js'
import { BEAT_MS, heldNumbers } from '@lib/outreach/prospects/callPresence.js'

const DESK_PATH = '/api/calls-desk'

/** What a caller is told when the board will not read. */
const NO_DESK = 'The call desk could not be read.'

/** And when a change to their setup will not save. */
const NO_SAVE = 'That setting could not be saved. Try it again.'

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
export function useCallDesk({ token, enabled }) {
  const [desk, setDesk] = useState(null)
  const [error, setError] = useState(null)
  const [claiming, setClaiming] = useState(false)
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
    setDesk(payload)
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
    async prospectId => {
      setClaiming(true)
      try {
        return Boolean(await send({ on_phone: prospectId }))
      } finally {
        if (alive.current) setClaiming(false)
      }
    },
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
  const you = desk?.you ?? null
  // Which number this console is on, read off the board rather than off the
  // ref the beat uses: the ref is what the beat needs and changing it does not
  // redraw anything, and the row that says whether the Hang Up control is on
  // screen has to.
  const onCall = useMemo(
    () => presence.find(row => row.user_id === you)?.prospect_id ?? null,
    [presence, you]
  )

  return {
    prefs: desk?.prefs ?? null,
    you,
    presence,
    held,
    onCall,
    error,
    claiming,
    loading: !desk && !error,
    takeNumber,
    dropNumber,
    savePrefs,
  }
}
