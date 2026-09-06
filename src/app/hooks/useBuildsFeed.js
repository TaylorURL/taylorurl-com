import { useCallback, useEffect, useRef, useState } from 'react'

const BUILDS_PATH = '/api/projects-admin'

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
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const ask = useCallback(
    async query => {
      const response = await fetch(`${BUILDS_PATH}${query}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(payload.error || `The builds endpoint answered ${response.status}.`)
      return payload
    },
    [token]
  )

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const payload = await ask(`?t=${Date.now()}`)
      if (!alive.current) return
      setProjects(Array.isArray(payload.projects) ? payload.projects : [])
      setError(null)
    } catch (fault) {
      if (alive.current) setError(fault.message)
    }
  }, [ask, token, enabled])

  useEffect(() => {
    load()
  }, [load])

  const readUpdates = useCallback(
    async projectId => {
      if (!token || !projectId) return
      try {
        const payload = await ask(`?project=${projectId}&t=${Date.now()}`)
        if (!alive.current) return
        setUpdates(Array.isArray(payload.updates) ? payload.updates : [])
        // Both arrive with the updates. A build opened before the configurator
        // carried a brief simply has none, which is a panel that does not
        // draw rather than a state worth reporting.
        setBrief(payload.brief || null)
        setTasks(Array.isArray(payload.tasks) ? payload.tasks : [])
      } catch (fault) {
        if (alive.current) setError(fault.message)
      }
    },
    [ask, token]
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
      setError(null)
      try {
        const response = await fetch(BUILDS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) setError(payload.error || 'That change did not go through.')
          return null
        }
        await load()
        if (open) await readUpdates(open)
        return payload
      } catch {
        if (alive.current) setError('That change did not reach the server.')
        return null
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, open, readUpdates]
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
      setError(null)
      try {
        const signed = await fetch(BUILDS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upload',
            project_id: open,
            content_type: file.type,
          }),
        })
        const place = await signed.json().catch(() => ({}))
        if (!signed.ok) {
          if (alive.current) setError(place.error || 'That file could not be sent.')
          return false
        }

        const put = await fetch(place.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!put.ok) {
          if (alive.current) setError('That file did not upload.')
          return false
        }

        const size = await measure(file)
        const recorded = await fetch(BUILDS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'media',
            update_id: updateId,
            path: place.path,
            caption,
            width: size.width,
            height: size.height,
          }),
        })
        const kept = await recorded.json().catch(() => ({}))
        if (!recorded.ok) {
          if (alive.current) setError(kept.error || 'That picture did not attach.')
          return false
        }

        if (open) await readUpdates(open)
        return true
      } catch {
        if (alive.current) setError('That picture did not reach the server.')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, open, readUpdates]
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
