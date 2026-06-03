import ReactMarkdown from 'react-markdown'
import { formatSmartTimestamp } from '@utils/sundayTime'

export default function MessageBubble({ role, content, createdAt, streaming = false }) {
  const isUser = role === 'user'
  const stamp = createdAt ? formatSmartTimestamp(createdAt) : ''
  return (
    <div
      className={`sunday-fade-up flex w-full flex-col gap-1 ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      <div
        className="max-w-[78%] rounded-2xl border px-3.5 py-2 text-[14px] leading-[1.55] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        style={{
          background: isUser ? 'var(--sunday-accent)' : 'var(--sunday-surface)',
          color: isUser ? 'var(--sunday-on-accent)' : 'var(--sunday-text)',
          borderColor: isUser ? 'var(--sunday-accent)' : 'var(--sunday-border-strong)',
          borderTopRightRadius: isUser ? '6px' : undefined,
          borderTopLeftRadius: !isUser ? '6px' : undefined,
        }}
      >
        <div className="break-words">
          {isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <div className="sunday-markdown">
              <ReactMarkdown>{content || ''}</ReactMarkdown>
            </div>
          )}
          {streaming && !content && <ThinkingDots />}
          {streaming && content && <StreamingCursor />}
        </div>
      </div>
      {stamp && (
        <time
          dateTime={createdAt}
          className="px-1 font-mono text-[10px] tabular-nums"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          {stamp}
        </time>
      )}
    </div>
  )
}

function ThinkingDots() {
  return (
    <span
      aria-label="Sunday is thinking"
      role="status"
      className="inline-flex items-center gap-1 py-1"
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          aria-hidden="true"
          className="sunday-thinking-dot inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: 'var(--sunday-text-muted)',
            animationDelay: `${i * 180}ms`,
          }}
        />
      ))}
    </span>
  )
}

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-3 w-[2px] translate-y-[1px] rounded-[1px]"
      style={{
        background: 'currentColor',
        opacity: 0.75,
        animation: 'sunday-cursor 1.05s steps(2) infinite',
      }}
    />
  )
}
