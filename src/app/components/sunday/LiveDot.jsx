import { cn } from '@utils/cn'

/**
 * A small status dot with an expanding aura behind it. Communicates
 * "this thing is currently live" — daemon health, active conversation,
 * streaming indicator, etc.
 *
 * Props:
 *   size  — dot diameter in px (default 7)
 *   tone  — "accent" | "positive" | "warning" | "danger" (default accent)
 *   label — optional uppercase mono label shown to the right of the dot
 *   pulsing — false suppresses the aura ring (still shows the solid dot)
 */
const TONE_COLOR = {
  accent: 'var(--sunday-accent-bright)',
  positive: 'var(--sunday-positive)',
  warning: 'var(--sunday-warning)',
  danger: 'var(--sunday-danger)',
}

export default function LiveDot({ size = 7, tone = 'accent', label, pulsing = true, className }) {
  const color = TONE_COLOR[tone] ?? TONE_COLOR.accent
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 align-middle', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        {pulsing && (
          <span
            className="sunday-pulse-aura absolute inset-0 rounded-full"
            aria-hidden="true"
            style={{ background: color }}
          />
        )}
        <span
          className="relative inline-block rounded-full"
          aria-hidden="true"
          style={{ width: size, height: size, background: color }}
        />
      </span>
      {label && (
        <span
          className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
