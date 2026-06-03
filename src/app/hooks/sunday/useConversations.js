import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import {
  deleteConversation as apiDeleteConversation,
  listConversations,
  renameConversation as apiRenameConversation,
} from '@data/sunday/conversationsClient'

/**
 * Live-tailed list of Sunday conversations. Subscribes to INSERT/UPDATE/DELETE
 * on sunday_conversations so the panel stays in sync as turns flow through.
 */
export function useConversations() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    listConversations()
      .then(rows => {
        if (!cancelled) {
          setConversations(rows)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err?.message ?? String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const channel = supabase
      .channel('sunday-conversations-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sunday_conversations' },
        payload => {
          setConversations(prev => mergeChange(prev, payload))
        }
      )
      .subscribe()
    channelRef.current = channel

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const removeConversation = useCallback(async id => {
    setConversations(prev => prev.filter(c => c.id !== id))
    try {
      await apiDeleteConversation(id)
    } catch (err) {
      setError(err?.message ?? String(err))
      const fresh = await listConversations().catch(() => [])
      setConversations(fresh)
    }
  }, [])

  const renameConversation = useCallback(async (id, title) => {
    const optimisticTitle = title?.slice(0, 80) ?? null
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, title: optimisticTitle } : c)))
    try {
      await apiRenameConversation(id, optimisticTitle)
    } catch (err) {
      setError(err?.message ?? String(err))
    }
  }, [])

  return { conversations, loading, error, removeConversation, renameConversation }
}

function mergeChange(prev, payload) {
  if (payload.eventType === 'INSERT') {
    if (prev.some(c => c.id === payload.new.id)) return prev
    return sortByLastMessage([payload.new, ...prev])
  }
  if (payload.eventType === 'UPDATE') {
    const next = prev.map(c => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
    return sortByLastMessage(next)
  }
  if (payload.eventType === 'DELETE') {
    return prev.filter(c => c.id !== payload.old.id)
  }
  return prev
}

function sortByLastMessage(rows) {
  return [...rows].sort(
    (a, b) =>
      new Date(b.last_message_at ?? b.started_at).getTime() -
      new Date(a.last_message_at ?? a.started_at).getTime()
  )
}
