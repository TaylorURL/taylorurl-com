import { useCallback, useEffect, useRef, useState } from 'react'

const PROJECTS_PATH = '/api/projects'

/**
 * The largest file a client may hand over.
 *
 * A photograph straight off a phone runs to a dozen megabytes and refusing one
 * would be refusing the most likely file anybody sends. Checked here as well as
 * at the bucket so somebody who picked a video finds out before waiting for it
 * to travel.
 */
const FILE_LIMIT_BYTES = 25 * 1024 * 1024

/**
 * The builds this account has paid for, and everything it can do to one.
 *
 * Read on a timer rather than once, because the other side of a project moves
 * without the client touching anything: a stage advances, an update is
 * written, a picture is attached. A tracker that only refreshed on a page load
 * would be a tracker somebody has to reload to trust, which is the opposite of
 * what one is for. A minute is slow enough to cost nothing and quick enough
 * that a client watching for a design has it before they think to refresh.
 *
 * Every change re-reads rather than patching what is on screen. Ticking the
 * last item of a stage can close that stage, which changes the bar, the panel
 * and what is written underneath it, and a local edit would have to guess at
 * all three.
 *
 * `acting` is the id of the item a change is in flight for, so one checkbox
 * can show its own progress without the panel going quiet.
 *
 * @param {{token: string|null, enabled: boolean, intervalMs?: number}} options
 * @returns {{projects: object[]|null, error: string|null, loading: boolean,
 *   acting: string|null, refresh: () => Promise<void>,
 *   tick: (taskId: string, done: boolean) => Promise<boolean>,
 *   answer: (taskId: string, text: string) => Promise<boolean>,
 *   send: (taskId: string, file: File) => Promise<boolean>,
 *   remove: (fileId: string) => Promise<boolean>,
 *   markSeen: (projectId: string) => Promise<boolean>}}
 */
export function useProjectFeed({ token, enabled, intervalMs = 60000 }) {
  const [projects, setProjects] = useState(null)
  const [phone, setPhone] = useState(null)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const response = await fetch(`${PROJECTS_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        // A signed-in account with no project is not an error and never
        // reaches here; this is the endpoint itself failing to answer.
        setError(payload.error || `Your project could not be read (${response.status}).`)
        return
      }
      setProjects(Array.isArray(payload.projects) ? payload.projects : [])
      setPhone(payload.phone || null)
      setError(null)
    } catch {
      if (alive.current) setError('Your project could not be read.')
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !enabled || !intervalMs) return undefined
    const timer = setInterval(load, intervalMs)
    return () => clearInterval(timer)
  }, [load, token, enabled, intervalMs])

  const act = useCallback(
    async (body, key) => {
      if (!token) return false
      setActing(key)
      try {
        const response = await fetch(PROJECTS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) setError(payload.error || 'That did not save.')
          return false
        }
        await load()
        if (alive.current) setError(null)
        return true
      } catch {
        if (alive.current) setError('That did not save.')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load]
  )

  const tick = useCallback(
    (taskId, done) => act({ action: 'tick', task_id: taskId, done }, taskId),
    [act]
  )

  const answer = useCallback(
    (taskId, text) => act({ action: 'answer', task_id: taskId, answer: text }, taskId),
    [act]
  )

  const remove = useCallback(fileId => act({ action: 'detach', file_id: fileId }, fileId), [act])

  /**
   * Hand a file over, in the three steps a private bucket needs.
   *
   * Signing, the upload itself and recording what landed are one action to the
   * person who chose a file, so they are one call here and one `acting` key.
   * A file that reaches the bucket but is never recorded is the only sequence
   * worth being careful about, and it costs an orphan in storage rather than
   * anything the client can see - which is the right way round, since the
   * other order would show them a logo the build cannot open.
   */
  const send = useCallback(
    async (taskId, file) => {
      if (!token || !file) return false
      if (file.size > FILE_LIMIT_BYTES) {
        if (alive.current) setError('That file is too big to send. 25MB is the limit.')
        return false
      }
      setActing(taskId)
      try {
        const signed = await fetch(PROJECTS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload', task_id: taskId, content_type: file.type }),
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

        const recorded = await fetch(PROJECTS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'attach',
            task_id: taskId,
            path: place.path,
            name: file.name,
          }),
        })
        const kept = await recorded.json().catch(() => ({}))
        if (!recorded.ok) {
          if (alive.current) setError(kept.error || 'That file did not attach.')
          return false
        }

        await load()
        if (alive.current) setError(null)
        return true
      } catch {
        if (alive.current) setError('That file did not reach the server.')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load]
  )

  const markSeen = useCallback(
    projectId => act({ action: 'seen', project_id: projectId }, projectId),
    [act]
  )

  return {
    projects,
    phone,
    error,
    loading: !projects && !error,
    acting,
    refresh: load,
    tick,
    answer,
    send,
    remove,
    markSeen,
  }
}
