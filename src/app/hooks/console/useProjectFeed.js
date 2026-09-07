import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'

const PROJECTS_PATH = '/api/projects'

/** What a client is told when the read behind their whole tracker fails. */
const NO_READ = 'Your project could not be read. Try again in a moment.'

/**
 * And when one of the things they can do to it does not happen. Each names the
 * one it belongs to, because a client looking at a checklist, a written answer
 * and a picker has four things on screen that could have been the one that
 * failed, and the general sentence leaves them to guess which.
 */
const NO_TICK = 'That item could not be ticked off. Try it again.'
const NO_ANSWER = 'That answer could not be saved. Try it again.'
const NO_REMOVE = 'That file could not be removed. Try it again.'
const NO_SEND = 'That file could not be sent. Try attaching it again.'
const NO_UPLOAD = 'That file could not be uploaded. Try attaching it again.'
const NO_ATTACH = 'That file could not be attached. Try it again.'

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
 * A read that does not land is held in `error` and takes the place of the
 * tracker, because there is nothing else to draw and a notice that faded after
 * eight seconds would leave a client staring at an empty panel. A change that
 * does not take leaves the tracker exactly as it was, so it is a notice in the
 * bottom-right corner of the screen rather than a banner over a tracker that
 * is still right.
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
  const toast = useToast()
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
        setError(faultFromResponse(response, payload, NO_READ))
        return
      }
      setProjects(Array.isArray(payload.projects) ? payload.projects : [])
      setPhone(payload.phone || null)
      setError(null)
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, NO_READ))
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

  /**
   * One change, and what the client is told when it does not happen.
   *
   * `fallback` is the sentence for a failure the far end had no words of its
   * own for, and passing none says nothing at all. That silence is for the
   * changes nobody asked for: marking a project seen is the page recording
   * that it drew, and a notice about it would be the tracker interrupting
   * somebody to report a thing they never started.
   */
  const act = useCallback(
    async (body, key, fallback) => {
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
          if (alive.current && fallback)
            toast(faultFromResponse(response, payload, fallback), 'error')
          return false
        }
        await load()
        return true
      } catch (cause) {
        if (alive.current && fallback) toast(faultMessage(cause, fallback), 'error')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, toast]
  )

  const tick = useCallback(
    (taskId, done) => act({ action: 'tick', task_id: taskId, done }, taskId, NO_TICK),
    [act]
  )

  const answer = useCallback(
    (taskId, text) => act({ action: 'answer', task_id: taskId, answer: text }, taskId, NO_ANSWER),
    [act]
  )

  const remove = useCallback(
    fileId => act({ action: 'detach', file_id: fileId }, fileId, NO_REMOVE),
    [act]
  )

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
        if (alive.current) toast('That file is too big to send. Choose one under 25MB.', 'error')
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
          if (alive.current) toast(faultFromResponse(signed, place, NO_SEND), 'error')
          return false
        }

        const put = await fetch(place.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        // The bucket answers a refused upload with its own XML rather than
        // anything a reader could use, so the status is the whole of what is
        // known here - and a status on its own is a case the door already
        // answers, which is why nothing is read off this response.
        if (!put.ok) {
          if (alive.current) toast(faultFromResponse(put, null, NO_UPLOAD), 'error')
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
          if (alive.current) toast(faultFromResponse(recorded, kept, NO_ATTACH), 'error')
          return false
        }

        await load()
        return true
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_ATTACH), 'error')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, toast]
  )

  // No sentence, because nobody asked for this one: it is the tracker
  // recording that the client has now seen what is on it.
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
