import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import { useAuth } from '@hooks/useAuth'
import { enqueueUserMessage, startConversation } from '@data/sunday/sundayApiClient'

const ACTIVE_CONV_KEY = 'sunday.activeConversationId'

/**
 * Sunday chat hook (Claude Code Max edition).
 *
 * Persists the active conversation id in localStorage so reloads land back in
 * the same thread. The DB is the source of truth for message content;
 * Supabase Realtime keeps the rendered view in sync as the daemon writes
 * streaming chunks into the assistant row.
 *
 * Public surface:
 *   messages, state, error, conversationId, lastAssistantText
 *   sendMessage(text)       — append a user turn (daemon picks it up)
 *   startNew()              — clear the active conversation; next sendMessage creates a fresh one
 *   cancel()                — no-op (kept for parity with the old SSE-based hook)
 */
export function useAgentChat() {
  const { user } = useAuth()
  const [conversationId, setConversationIdState] = useState(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(ACTIVE_CONV_KEY) || null
  })
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)
  const [lastAssistantText, setLastAssistantText] = useState('')
  const lastFinalizedRef = useRef(null)

  const setConversationId = useCallback(next => {
    setConversationIdState(next)
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(ACTIVE_CONV_KEY, next)
      else window.localStorage.removeItem(ACTIVE_CONV_KEY)
    }
  }, [])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      lastFinalizedRef.current = null
      return
    }
    let cancelled = false

    loadConversationMessages(conversationId)
      .then(rows => {
        if (!cancelled) setMessages(rows)
      })
      .catch(err => {
        if (!cancelled) setError(err?.message ?? String(err))
      })

    const channel = supabase
      .channel(`sunday-conv-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sunday_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          setMessages(prev => mergeMessage(prev, payload.new))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sunday_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          setMessages(prev => mergeMessage(prev, payload.new))
          if (
            payload.new.role === 'assistant' &&
            payload.new.status === 'complete' &&
            payload.new.content &&
            lastFinalizedRef.current !== payload.new.id
          ) {
            lastFinalizedRef.current = payload.new.id
            setLastAssistantText(payload.new.content)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const sendMessage = useCallback(
    async rawText => {
      const text = rawText?.trim()
      if (!text) return
      if (!user?.id) {
        setError('Not signed in.')
        return
      }
      setError(null)
      try {
        let convId = conversationId
        if (!convId) {
          convId = await startConversation({ userId: user.id, title: text })
          setConversationId(convId)
        }
        await enqueueUserMessage({ conversationId: convId, userId: user.id, content: text })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [user?.id, conversationId, setConversationId]
  )

  const startNew = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError(null)
    setLastAssistantText('')
    lastFinalizedRef.current = null
  }, [setConversationId])

  const selectConversation = useCallback(
    id => {
      if (id === conversationId) return
      setError(null)
      setLastAssistantText('')
      lastFinalizedRef.current = null
      setMessages([])
      setConversationId(id || null)
    },
    [conversationId, setConversationId]
  )

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const errorFromAssistant = lastAssistant?.status === 'error' ? lastAssistant.error : null
  const state =
    error || errorFromAssistant
      ? 'error'
      : lastAssistant?.status === 'streaming' || lastAssistant?.status === 'pending'
        ? 'streaming'
        : 'idle'

  return {
    messages: messages.map(toUiShape),
    state,
    error: error ?? errorFromAssistant ?? null,
    conversationId,
    lastAssistantText,
    sendMessage,
    startNew,
    selectConversation,
    cancel: () => {},
  }
}

async function loadConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from('sunday_messages')
    .select('id, role, content, tool_calls, status, error, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

function mergeMessage(prev, row) {
  const existing = prev.findIndex(m => m.id === row.id)
  if (existing === -1) {
    return [...prev, row].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }
  const copy = [...prev]
  copy[existing] = { ...copy[existing], ...row }
  return copy
}

function toUiShape(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content ?? '',
    toolCalls: Array.isArray(row.tool_calls) ? row.tool_calls : [],
    pending: row.status === 'streaming' || row.status === 'pending',
    error: row.status === 'error' ? row.error : null,
    createdAt: row.created_at,
  }
}
