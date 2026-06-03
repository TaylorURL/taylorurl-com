import { cn } from '@utils/cn'

/**
 * Field — uniform label + hint chrome that wraps any Sunday form control.
 * Uses the global .sunday-eyebrow recipe (Geist Sans medium 11px muted)
 * so every form field across the app shares one legible label treatment.
 */
export function Field({ label, hint, htmlFor, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || hint) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="sunday-eyebrow">
              {label}
            </label>
          )}
          {hint && (
            <span className="text-[11.5px]" style={{ color: 'var(--sunday-text-muted)' }}>
              {hint}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
