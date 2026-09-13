import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { putSigned, readEndpoint, writeEndpoint } from './endpoint'
import { useAlive } from './useAlive'
import { usePulse } from './usePulse'

const BUILDS_PATH = '/api/projects-admin'

/** How often the record is read again: a build moves as it is worked, and a
 * client answers a checklist from their own console without this one hearing. */
const PULSE_MS = 30_000

/** What a reader is told when one of the two reads does not land. */
const NO_LIST = 'The builds could not be read. Try again in a moment.'
const NO_BUILD = 'That build could not be opened. Try again in a moment.'

/** And when a change, or one of the three steps a capture goes up in, does not. */
const NO_CHANGE = 'That change could not be saved. Try it again.'
const NO_SEND = 'That picture could not be sent. Try attaching it again.'
const NO_UPLOAD = 'That picture could not be uploaded. Try attaching it again.'
const NO_ATTACH = 'That picture could not be attached. Try it again.'

/**
 * Every build in progress, and every change that can be made to one.
 *
 * The list and one build's detail are read separately because they are read at
 * different times: the list is what the page opens on, and the updates, the
 * brief and the checklist belong to whichever build is being worked on at that
 * moment. Reading all of that for every build to draw a table of stages would
 * be most of the record fetched to show none of it.
 *
 * Every change re-reads rather than patching what is on screen. Advancing a
 * stage can close a build outright, and writing an update against a stage
 * moves what the next one defaults to, so a local edit would have to guess at
 * both.
 *
 * A read that does not land is held in `error`, because the section has
 * nothing to draw without it and a notice that fades would leave an empty
 * table with no account of itself. A change or an attachment that does not
 * take leaves everything on screen standing, so it is a notice instead.
 *
 * `acting` is the key of the row a change is in flight for, so one control can
 * show its own progress without the table going quiet.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{projects: object[]|null, updates: object[]|null, brief: object|null,
 *   tasks: object[], error: string|null,
 *   loading: boolean, updatesLoading: boolean, acting: string|null,
 *   refresh: () => Promise<void>, openBuild: (projectId: string|null) => Promise<void>,
 *   act: (body: object, key: string) => Promise<object|null>,
 *   attach: (updateId: string, file: File, caption: string, key: string) => Promise<boolean>}}
 */
export function useBuildsFeed({ token, enabled }) {
  const [projects, setProjects] = useState(null)
  const [updates, setUpdates] = useState(null)
  const [brief, setBrief] = useState(null)
  const [tasks, setTasks] = useState([])
  const [open, setOpen] = useState(null)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(null)
  const toast = useToast()
  const alive = useAlive()

  /**
   * One read, with a refusal thrown rather than returned.
   *
   * The sentence is chosen here because this is where the response and its
   * body are both in hand, and `fallback` is passed in because only the caller
   * knows whether it was reading the table of builds or one build's updates.
   * A request that never landed at all throws before any of that and reaches
   * the caller as whatever the browser said, which is why both callers put
   * what they catch through the same door again.
   */
  const ask = useCallback(
    async (query, fallback) => {
      const { response, payload } = await readEndpoint(token, `${BUILDS_PATH}${query}`)
      if (!response.ok) throw new Error(faultFromResponse(response, payload, fallback))
      return payload
    },
    [token]
  )

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const payload = await ask(`?t=${Date.now()}`, NO_LIST)
      if (!alive.current) return
      setProjects(Array.isArray(payload.projects) ? payload.projects : [])
      setError(null)
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, NO_LIST))
    }
  }, [ask, token, enabled, alive])

  useEffect(() => {
    load()
  }, [load])

  const readUpdates = useCallback(
    async projectId => {
      if (!token || !projectId) return
      try {
        const payload = await ask(`?project=${projectId}&t=${Date.now()}`, NO_BUILD)
        if (!alive.current) return
        setUpdates(Array.isArray(payload.updates) ? payload.updates : [])
        // Both arrive with the updates. A build opened before the configurator
        // carried a brief simply has none, which is a panel that does not
        // draw rather than a state worth reporting.
        setBrief(payload.brief || null)
        setTasks(Array.isArray(payload.tasks) ? payload.tasks : [])
        // `error` is the one place both reads report to, so a build that opens
        // clears it rather than leaving an earlier failure standing over a
        // record that arrived.
        setError(null)
      } catch (cause) {
        if (alive.current) setError(faultMessage(cause, NO_BUILD))
      }
    },
    [ask, token, alive]
  )

  /**
   * Put one build in front of the reader, or close the one that is.
   *
   * The held updates are cleared on the way in rather than left standing,
   * because one build's updates under another build's heading is worse than a
   * moment of nothing.
   */
  const openBuild = useCallback(
    async projectId => {
      setOpen(projectId)
      setUpdates(null)
      setBrief(null)
      setTasks([])
      if (projectId) await readUpdates(projectId)
    },
    [readUpdates]
  )

  const act = useCallback(
    async (body, key) => {
      if (!token) return null
      setActing(key)
      try {
        const { response, payload } = await writeEndpoint(token, BUILDS_PATH, body)
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_CHANGE), 'error')
          return null
        }
        await load()
        if (open) await readUpdates(open)
        return payload
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_CHANGE), 'error')
        return null
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, open, readUpdates, toast, alive]
  )

  /**
   * Put a picture on an update, in the two steps the private bucket needs.
   *
   * The dimensions are read here rather than on the server, because the browser
   * has the image decoded already and the server would have to parse the file
   * to learn what the page it came from could simply be asked.
   */
  const attach = useCallback(
    async (updateId, file, caption, key) => {
      if (!token || !file) return false
      setActing(key)
      try {
        const { response: signed, payload: place } = await writeEndpoint(token, BUILDS_PATH, {
          action: 'upload',
          project_id: open,
          content_type: file.type,
        })
        if (!signed.ok) {
          if (alive.current) toast(faultFromResponse(signed, place, NO_SEND), 'error')
          return false
        }

        const refused = await putSigned(place.url, file, NO_UPLOAD)
        if (refused) {
          if (alive.current) toast(refused, 'error')
          return false
        }

        const size = await measure(file)
        const { response: recorded, payload: kept } = await writeEndpoint(token, BUILDS_PATH, {
          action: 'media',
          update_id: updateId,
          path: place.path,
          caption,
          width: size.width,
          height: size.height,
        })
        if (!recorded.ok) {
          if (alive.current) toast(faultFromResponse(recorded, kept, NO_ATTACH), 'error')
          return false
        }

        if (open) await readUpdates(open)
        return true
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_ATTACH), 'error')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, open, readUpdates, toast, alive]
  )

  // The record again on a beat: the list, and the open build's own reads with
  // it, so the checklist and the updates move as the client answers them. It
  // stands off while a change is in flight, which would otherwise race the
  // re-read that change ends on.
  usePulse(
    async () => {
      await load()
      if (open) await readUpdates(open)
    },
    { enabled: Boolean(token) && enabled, intervalMs: PULSE_MS, holdWhile: Boolean(acting) }
  )

  return {
    projects,
    updates,
    brief,
    tasks,
    open,
    error,
    loading: !projects && !error,
    updatesLoading: Boolean(open) && !updates,
    acting,
    refresh: load,
    openBuild,
    act,
    attach,
  }
}

/**
 * How wide and tall a picture is, or nothing where the browser will not say.
 *
 * The two numbers are what stop a page reflowing as each capture arrives. A
 * file the browser cannot decode is still worth attaching, so a failure here
 * returns nulls rather than refusing the upload that has already happened.
 *
 * @param {File} file
 * @returns {Promise<{width: number|null, height: number|null}>}
 */
function measure(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: null, height: null })
    }
    image.src = url
  })
}
