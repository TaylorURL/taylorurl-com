import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useSundayGuard } from '@hooks/sunday/useSundayGuard'
import { signOut } from '@hooks/useAuth'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'
import SundayNav from '@components/sunday/SundayNav'
import LiveDot from '@components/sunday/LiveDot'
import { formatTime } from '@utils/sundayTime'
import { useDeviceHeartbeat } from '@hooks/sunday/useDeviceHeartbeat'

const THEMES = ['dark', 'light']
const THEME_STORAGE_KEY = 'sunday.theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return THEMES.includes(stored) ? stored : 'dark'
}

export default function SundayLayout() {
  const guard = useSundayGuard()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(getInitialTheme)
  useDeviceHeartbeat()

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    // Mirror the theme attribute on <html> so Radix portals (Select panels,
    // Tooltips, etc.) mounted under document.body inherit Sunday's CSS vars.
    document.documentElement.setAttribute('data-sunday-theme', theme)
    return () => {
      document.documentElement.removeAttribute('data-sunday-theme')
    }
  }, [theme])

  useEffect(() => {
    if (guard.state === 'unauthenticated') {
      navigate(SUNDAY_ROUTES.AUTH, { replace: true })
    }
  }, [guard.state, navigate])

  if (guard.state === 'loading') {
    return (
      <div
        className="sunday-root flex min-h-screen items-center justify-center"
        data-sunday-theme={theme}
        style={{ background: 'var(--sunday-bg)', color: 'var(--sunday-text-muted)' }}
      >
        <div className="font-mono text-[12px] tracking-wide">Loading…</div>
      </div>
    )
  }

  if (guard.state === 'forbidden') {
    return (
      <div
        className="sunday-root flex min-h-screen items-center justify-center px-6"
        data-sunday-theme={theme}
        style={{
          background: 'var(--sunday-bg)',
          backgroundImage: 'var(--sunday-bg-mesh)',
          color: 'var(--sunday-text)',
        }}
      >
        <div
          className="w-full max-w-sm space-y-4 rounded-lg border p-6"
          style={{
            background: 'var(--sunday-surface)',
            borderColor: 'var(--sunday-border-strong)',
          }}
        >
          <h1 className="text-[15px] font-semibold tracking-tight">Sunday is admin-only</h1>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--sunday-text-muted)' }}>
            You're signed in but this account isn't the admin user.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium"
            style={{
              background: 'var(--sunday-surface-2)',
              color: 'var(--sunday-text)',
              borderColor: 'var(--sunday-border-strong)',
            }}
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (guard.state !== 'authorized') return null

  return (
    <div
      className="sunday-root flex h-screen overflow-hidden"
      data-sunday-theme={theme}
      style={{
        background: 'var(--sunday-bg)',
        backgroundImage: 'var(--sunday-bg-mesh)',
        backgroundAttachment: 'fixed',
        color: 'var(--sunday-text)',
      }}
    >
      <Helmet>
        <title>Sunday</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <SundayNav />
      <main className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-6"
          style={{
            borderColor: 'var(--sunday-border)',
            background: 'var(--sunday-bg-elevated)',
          }}
        >
          <HeartbeatStatus />
          <div className="flex items-center gap-2">
            <ThemeSwitcher theme={theme} onChange={setTheme} />
            <button
              type="button"
              onClick={() => signOut()}
              aria-label="Sign out"
              className="sunday-press inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium"
              style={{
                background: 'var(--sunday-surface)',
                color: 'var(--sunday-text-muted)',
                borderColor: 'var(--sunday-border-strong)',
                transition:
                  'color 140ms var(--sunday-ease-out), border-color 140ms var(--sunday-ease-out), transform 100ms var(--sunday-ease-out)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--sunday-text)'
                e.currentTarget.style.borderColor = 'var(--sunday-border-hover)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--sunday-text-muted)'
                e.currentTarget.style.borderColor = 'var(--sunday-border-strong)'
              }}
            >
              <LogOut size={11} />
              Sign out
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/**
 * Tiny live "Sunday is alive" indicator in the global header — a pulsing
 * dot + a current CT clock that ticks once a second.
 */
function HeartbeatStatus() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <LiveDot tone="positive" />
        <span className="text-[12.5px] font-medium" style={{ color: 'var(--sunday-text-muted)' }}>
          Sunday online
        </span>
      </div>
      <span
        className="hidden text-[12.5px] font-medium tabular-nums sm:inline"
        style={{ color: 'var(--sunday-text-muted)' }}
      >
        {formatTime(now)} CT
      </span>
    </div>
  )
}

function ThemeSwitcher({ theme, onChange }) {
  const isDark = theme === 'dark'
  const next = isDark ? 'light' : 'dark'
  const Icon = isDark ? Sun : Moon
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="sunday-press inline-flex h-7 w-7 items-center justify-center rounded-md border"
      style={{
        background: 'var(--sunday-surface)',
        color: 'var(--sunday-text-muted)',
        borderColor: 'var(--sunday-border-strong)',
        transition:
          'color 140ms var(--sunday-ease-out), border-color 140ms var(--sunday-ease-out), transform 100ms var(--sunday-ease-out)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--sunday-text)'
        e.currentTarget.style.borderColor = 'var(--sunday-border-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--sunday-text-muted)'
        e.currentTarget.style.borderColor = 'var(--sunday-border-strong)'
      }}
    >
      <Icon size={13} strokeWidth={2} />
    </button>
  )
}
