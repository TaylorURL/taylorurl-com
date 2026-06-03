/**
 * Bordered surface — the unit container for Sunday cards/panels.
 * Now uses sunday-card-alive: subtle hover lift + accent border breath,
 * keeping reads natural while making the page feel reactive.
 */
export default function Surface({ children, className = '', as: As = 'section', ...rest }) {
  return (
    <As
      className={`sunday-card-alive rounded-lg border p-4 ${className}`}
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
        color: 'var(--sunday-text)',
      }}
      {...rest}
    >
      {children}
    </As>
  )
}

export function SurfaceHeader({ title, subtitle, action, eyebrow }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="sunday-eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function Divider() {
  return (
    <div
      role="separator"
      aria-hidden="true"
      className="my-3 h-px"
      style={{ background: 'var(--sunday-border)' }}
    />
  )
}
