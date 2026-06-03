import { useEffect, useRef, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import { listDispatchLogs, listDispatches } from '@data/sunday/dispatchClient'

export function useDispatches({ projectId } = {}) {
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDispatches({ projectId })
      .then(rows => {
        if (!cancelled) {
          setDispatches(rows)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message ?? String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const channel = supabase
      .channel(`sunday-dispatches-${projectId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sunday_code_queue' },
        payload => {
          setDispatches(prev => {
            const row = payload.new ?? payload.old
            if (!row) return prev
            if (projectId && row.project_id !== projectId) return prev
            if (payload.eventType === 'INSERT') return [row, ...prev]
            if (payload.eventType === 'UPDATE') {
              return prev.map(d => (d.id === row.id ? { ...d, ...row } : d))
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter(d => d.id !== row.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [projectId])

  return { dispatches, loading, error }
}

export function useDispatchLogs(dispatchId) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!dispatchId) {
      setLogs([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    listDispatchLogs(dispatchId)
      .then(rows => {
        if (!cancelled) setLogs(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const channel = supabase
      .channel(`sunday-dispatch-logs-${dispatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sunday_code_logs',
          filter: `dispatch_id=eq.${dispatchId}`,
        },
        payload => {
          setLogs(prev => [...prev, payload.new])
        }
      )
      .subscribe()
    channelRef.current = channel

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [dispatchId])

  return { logs, loading }
}
