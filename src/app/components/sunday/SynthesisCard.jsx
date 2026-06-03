import Surface from '@components/sunday/Surface'
import { formatLocalDateString } from '@utils/sundayTime'

export default function SynthesisCard({ synthesis }) {
  if (!synthesis) {
    return (
      <Surface>
        <p
          className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          Yesterday
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-tight">No synthesis yet</h2>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          The daemon writes a synthesis nightly. After your first day of conversation, the
          highlights will appear here.
        </p>
      </Surface>
    )
  }

  const date = formatLocalDateString(synthesis.date, { long: true })

  return (
    <Surface>
      <header className="mb-3 flex items-baseline justify-between">
        <p
          className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          Yesterday · {date}
        </p>
      </header>
      {synthesis.summary && (
        <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--sunday-text)' }}>
          {synthesis.summary}
        </p>
      )}
      <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
        <SynthesisSection title="Themes" items={synthesis.themes} />
        <SynthesisSection title="Accomplished" items={synthesis.accomplishments} />
        <SynthesisSection title="Pending" items={synthesis.pending} />
        <SynthesisSection title="Queued" items={synthesis.queued_for_tomorrow} />
        {Array.isArray(synthesis.surprises) && synthesis.surprises.length > 0 && (
          <div className="md:col-span-2">
            <SynthesisSection title="Surprises" items={synthesis.surprises} />
          </div>
        )}
      </div>
    </Surface>
  )
}

function SynthesisSection({ title, items }) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return null
  return (
    <div>
      <h3
        className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
        style={{ color: 'var(--sunday-text-faint)' }}
      >
        {title}
      </h3>
      <ul className="space-y-1 text-[13px] leading-snug">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: 'var(--sunday-text-faint)' }}>·</span>
            <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
