import { fullCount } from './lib/format'

/**
 * The card a chart's tooltip draws, so every chart in the console answers a
 * hover the same way: the bucket on one line, then a row per series with its
 * swatch, its name and its figure.
 */
export function TooltipCard({ title, rows }) {
  return (
    <div className="panel-static bg-paper px-3 py-2">
      <p className="text-paper-faint font-mono text-[11px]">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {rows.map(row => (
          <li key={row.label} className="flex items-baseline gap-3 whitespace-nowrap text-[12px]">
            <span className="flex items-center gap-1.5 text-paper-soft">
              {row.color && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded"
                  style={{ background: row.color }}
                />
              )}
              {row.label}
            </span>
            <span className="ml-auto font-mono font-semibold tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * What a ring of sessions says over one slice: its name, its sessions, and its
 * share of the total the ring was handed.
 */
export function ShareTooltip({ active, payload, total }) {
  return active && payload?.length ? (
    <TooltipCard
      title={payload[0].name}
      rows={[
        { label: 'Sessions', value: fullCount(payload[0].value) },
        {
          label: 'Share',
          value: total ? `${Math.round((payload[0].value / total) * 100)}%` : '—',
        },
      ]}
    />
  ) : null
}
