import { NavLink } from 'react-router-dom'
import { SUNDAY_NAV_ITEMS } from '@constants/sunday/routes'
import BreathingBrand from '@components/sunday/BreathingBrand'
import LiveDot from '@components/sunday/LiveDot'

export default function SundayNav() {
  return (
    <nav
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r"
      style={{
        borderColor: 'var(--sunday-border)',
        background: 'var(--sunday-bg-elevated)',
      }}
    >
      <div
        className="flex h-14 items-center gap-3 border-b px-4"
        style={{ borderColor: 'var(--sunday-border)' }}
      >
        <BreathingBrand size={28} />
        <div className="min-w-0">
          <div
            className="text-[14px] font-semibold leading-tight tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            Sunday
          </div>
          <div
            className="font-mono text-[9.5px] uppercase leading-tight tracking-[0.16em]"
            style={{ color: 'var(--sunday-text-faint)' }}
          >
            personal agent
          </div>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 p-2.5">
        {SUNDAY_NAV_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.end}
                className="sunday-press group relative flex items-center gap-2.5 overflow-hidden rounded-md px-3 py-2 text-[13px] font-medium"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--sunday-text)' : 'var(--sunday-text-muted)',
                  background: isActive ? 'var(--sunday-surface)' : 'transparent',
                  transition:
                    'background 160ms var(--sunday-ease-out), color 160ms var(--sunday-ease-out)',
                })}
              >
                {({ isActive }) => (
                  <>
                    {/* accent rail with soft glow when active */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{
                        background: 'var(--sunday-accent)',
                        opacity: isActive ? 1 : 0,
                        boxShadow: isActive ? '0 0 10px var(--sunday-accent-glow)' : 'none',
                        transition:
                          'opacity 200ms var(--sunday-ease-out), box-shadow 200ms var(--sunday-ease-out)',
                      }}
                    />
                    {/* hover wash */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      style={{
                        background:
                          'linear-gradient(90deg, var(--sunday-accent-softer) 0%, transparent 100%)',
                      }}
                    />
                    {Icon && (
                      <Icon
                        size={15}
                        strokeWidth={isActive ? 2.25 : 1.85}
                        className="relative shrink-0"
                        style={{
                          color: isActive ? 'var(--sunday-accent-bright)' : 'currentColor',
                          transition: 'color 160ms var(--sunday-ease-out)',
                        }}
                      />
                    )}
                    <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <div
        className="flex items-center justify-between border-t px-4 py-3"
        style={{ borderColor: 'var(--sunday-border)' }}
      >
        <LiveDot tone="positive" label="online" />
        <span
          className="font-mono text-[9.5px] uppercase tracking-[0.16em]"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          v1 · max
        </span>
      </div>
    </nav>
  )
}
