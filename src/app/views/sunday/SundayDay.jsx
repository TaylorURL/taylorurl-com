import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import MessageBubble from '@components/sunday/MessageBubble'
import Surface, { SurfaceHeader } from '@components/sunday/Surface'
import SynthesisCard from '@components/sunday/SynthesisCard'
import { useSynthesisForDate } from '@hooks/sunday/useSynthesis'
import { listMessagesForDate } from '@data/sunday/messagesClient'
import { formatLocalDateString } from '@utils/sundayTime'

export default function SundayDay() {
  const { date } = useParams()
  const { synthesis } = useSynthesisForDate(date)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMessagesForDate(date)
      .then(rows => {
        if (!cancelled) setMessages(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  const formatted = formatLocalDateString(date, { long: true }) || date

  return (
    <div className="w-full space-y-5 px-8 py-8">
      <header>
        <p
          className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          Day view
        </p>
        <h1 className="mt-1 text-[24px] font-semibold leading-none tracking-tight">{formatted}</h1>
      </header>

      <SynthesisCard synthesis={synthesis} />

      <Surface>
        <SurfaceHeader
          title="Conversations"
          subtitle={`${messages.length} message${messages.length === 1 ? '' : 's'}`}
        />
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="sunday-skeleton h-10 w-full" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
            No conversations on this day.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div
                key={m.id}
                className="sunday-rise-in"
                style={{ animationDelay: `${Math.min(i * 30, 180)}ms` }}
              >
                <MessageBubble role={m.role} content={m.content ?? ''} />
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  )
}
