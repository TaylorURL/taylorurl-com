import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import {
  completeTask as apiCompleteTask,
  createScheduledPrompt,
  createTask,
  deleteScheduledPrompt,
  deleteTask,
  listScheduledPrompts,
  listTasks,
  reopenTask as apiReopenTask,
  runScheduledPromptNow,
  updateScheduledPrompt,
} from '@data/sunday/tasksClient'

/**
 * One-off tasks — surfaces on the Today page and inside project detail.
 * The Tasks page itself no longer uses this hook; it's a scheduled-prompts manager.
 */
export function useTasks({ status, projectId } = {}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const statusKey = Array.isArray(status) ? status.join(',') : (status ?? '')

  const refresh = useCallback(async () => {
    try {
      const rows = await listTasks({ status, projectId })
      setTasks(rows)
      setError(null)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, projectId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh().catch(() => {})

    const channel = supabase
      .channel(`sunday-tasks-${statusKey}-${projectId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_tasks' }, () => {
        if (!cancelled) refresh().catch(() => {})
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, projectId])

  const complete = useCallback(
    async id => {
      setTasks(prev =>
        prev.map(t =>
          t.id === id ? { ...t, status: 'done', completed_at: new Date().toISOString() } : t
        )
      )
      try {
        await apiCompleteTask(id)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh()
      }
    },
    [refresh]
  )

  const reopen = useCallback(
    async id => {
      setTasks(prev =>
        prev.map(t => (t.id === id ? { ...t, status: 'open', completed_at: null } : t))
      )
      try {
        await apiReopenTask(id)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh()
      }
    },
    [refresh]
  )

  const remove = useCallback(
    async id => {
      setTasks(prev => prev.filter(t => t.id !== id))
      try {
        await deleteTask(id)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh()
      }
    },
    [refresh]
  )

  const add = useCallback(async ({ userId, title, priority, projectId: pid, due }) => {
    if (!title?.trim()) return
    try {
      const created = await createTask({
        userId,
        title,
        priority,
        projectId: pid ?? null,
        due: due ?? null,
      })
      if (created) {
        // Optimistic insert so the new row paints (and fade-ups) immediately,
        // without waiting on the Realtime round-trip. Dedupe by id in case
        // Realtime also fires shortly after.
        setTasks(prev => [created, ...prev.filter(t => t.id !== created.id)])
      }
      return created
    } catch (err) {
      setError(err?.message ?? String(err))
      return null
    }
  }, [])

  return { tasks, loading, error, complete, reopen, remove, add, refresh }
}

/**
 * Scheduled prompts — recurring templates with prompts that Sunday auto-runs
 * in a background chat when the rule fires. Powers the Tasks page.
 */
export function useScheduledPrompts() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const rows = await listScheduledPrompts()
      setItems(rows)
      setError(null)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh().catch(() => {})

    const channel = supabase
      .channel('sunday-scheduled-prompts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_tasks' }, () => {
        if (!cancelled) refresh().catch(() => {})
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const add = useCallback(
    async ({ userId, title, rule, prompt, priority, projectId, fireHour, fireMinute }) => {
      if (!title?.trim() || !rule?.trim()) return
      try {
        const created = await createScheduledPrompt({
          userId,
          title,
          rule,
          prompt,
          priority,
          projectId: projectId ?? null,
          fireHour,
          fireMinute,
        })
        if (created) {
          // Optimistic prepend so the new scheduled prompt appears (and
          // fade-ups) immediately — no waiting on Realtime to round-trip.
          setItems(prev => [created, ...prev.filter(t => t.id !== created.id)])
        }
        return created
      } catch (err) {
        setError(err?.message ?? String(err))
        return null
      }
    },
    []
  )

  const update = useCallback(
    async (id, patch) => {
      setItems(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
      try {
        await updateScheduledPrompt(id, patch)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh()
      }
    },
    [refresh]
  )

  const remove = useCallback(
    async id => {
      setItems(prev => prev.filter(r => r.id !== id))
      try {
        await deleteScheduledPrompt(id)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh()
      }
    },
    [refresh]
  )

  const runNow = useCallback(async ({ userId, template }) => {
    try {
      return await runScheduledPromptNow({ userId, template })
    } catch (err) {
      setError(err?.message ?? String(err))
      return null
    }
  }, [])

  return { items, loading, error, add, update, remove, runNow, refresh }
}
