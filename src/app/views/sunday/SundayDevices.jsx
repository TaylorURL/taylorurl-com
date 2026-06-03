import { useState } from 'react'
import { Monitor, MonitorSmartphone, Smartphone, Tablet, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/button'
import LiveDot from '@components/sunday/LiveDot'
import Surface from '@components/sunday/Surface'
import { useDevices } from '@hooks/sunday/useDevices'
import { formatRelative, formatShortDate } from '@utils/sundayTime'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
]

const DEVICE_ICON = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
}

export default function SundayDevices() {
  const { devices, onlineCount, loading, forget } = useDevices()
  const [filterKey, setFilterKey] = useState('all')

  const filtered = devices.filter(d => {
    if (filterKey === 'online') return d.online
    if (filterKey === 'offline') return !d.online
    return true
  })

  return (
    <div className="w-full space-y-6 px-8 py-8">
      <header className="sunday-fade-up space-y-2.5">
        <h1
          className="text-[28px] font-semibold leading-tight tracking-tight"
          style={{ color: 'var(--sunday-text)' }}
        >
          Devices
        </h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <LiveDot tone="positive" />
          <p
            className="text-[13.5px] font-medium tabular-nums"
            style={{ color: 'var(--sunday-text-muted)' }}
          >
            <span style={{ color: 'var(--sunday-positive)' }}>{onlineCount}</span> online ·{' '}
            {devices.length} total
          </p>
        </div>
        <p
          className="max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          Browsers signed in to Sunday. Each one pulses a heartbeat every 30 seconds while a Sunday
          tab is open — &ldquo;online&rdquo; means a heartbeat landed in the last 90 seconds.
        </p>
        <p
          className="max-w-2xl rounded-md border px-3 py-2 text-[12.5px] leading-relaxed"
          style={{
            background: 'var(--sunday-accent-softer)',
            borderColor: 'var(--sunday-accent-soft)',
            color: 'var(--sunday-text-muted)',
          }}
        >
          Heads up — this is just about browser sessions. Sunday's background daemon runs
          independently on Trenton's Mac, so scheduled tasks fire on time even when nothing on this
          page is &ldquo;online.&rdquo;
        </p>
      </header>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map(f => {
          const active = f.key === filterKey
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className="sunday-press rounded-md border px-2.5 py-1 text-[12px]"
              style={{
                background: active ? 'var(--sunday-surface-2)' : 'var(--sunday-surface)',
                borderColor: active ? 'var(--sunday-border-hover)' : 'var(--sunday-border-strong)',
                color: active ? 'var(--sunday-text)' : 'var(--sunday-text-muted)',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading && devices.length === 0 ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <Surface>
          <p className="py-3 text-center text-[13px]" style={{ color: 'var(--sunday-text-muted)' }}>
            {filterKey === 'all'
              ? 'No devices yet — sign in from one to see it here.'
              : `No ${filterKey} devices.`}
          </p>
        </Surface>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((device, i) => (
            <DeviceCard
              key={device.id}
              device={device}
              onForget={forget}
              animationDelay={`${Math.min(i * 40, 200)}ms`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DeviceCard({ device, onForget, animationDelay }) {
  const Icon = DEVICE_ICON[device.device_type] ?? MonitorSmartphone

  function handleForget() {
    const message = device.isThisDevice
      ? "Forget this device? You'll re-register on the next page load."
      : `Forget "${device.label}" from history?`
    if (window.confirm(message)) onForget(device.id)
  }

  return (
    <div
      className="sunday-card-alive sunday-fade-up flex flex-col gap-3 rounded-lg border p-4"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: device.online ? 'var(--sunday-border-hover)' : 'var(--sunday-border-strong)',
        animationDelay,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
            style={{
              background: 'var(--sunday-bg-elevated)',
              borderColor: 'var(--sunday-border-strong)',
              color: device.online ? 'var(--sunday-accent-bright)' : 'var(--sunday-text-muted)',
            }}
          >
            <Icon size={17} strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-semibold leading-tight tracking-tight">
              {device.label}
            </h2>
            <p
              className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-[0.12em]"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              {device.device_type}
              {device.user_name && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--sunday-accent-bright)' }}>{device.user_name}</span>
                </>
              )}
            </p>
          </div>
        </div>
        {device.isThisDevice && (
          <span
            className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em]"
            style={{
              background: 'var(--sunday-accent-soft)',
              borderColor: 'var(--sunday-accent-soft)',
              color: 'var(--sunday-accent-bright)',
            }}
          >
            this device
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <LiveDot tone={device.online ? 'positive' : 'warning'} pulsing={device.online} />
        <span
          className="font-mono text-[10.5px] uppercase tracking-[0.14em]"
          style={{
            color: device.online ? 'var(--sunday-positive)' : 'var(--sunday-text-muted)',
          }}
        >
          {device.online ? 'Online now' : `Last seen ${formatRelative(device.last_seen_at)}`}
        </span>
      </div>

      <div
        className="flex items-center justify-between border-t pt-2"
        style={{ borderColor: 'var(--sunday-border)' }}
      >
        <p
          className="font-mono text-[10px] tabular-nums"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          First connected {formatShortDate(device.first_seen_at)}
        </p>
        <Button variant="ghost" size="xs" onClick={handleForget}>
          <Trash2 size={11} strokeWidth={2.1} />
          Forget
        </Button>
      </div>
    </div>
  )
}

function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sunday-skeleton h-32 w-full rounded-lg" />
      ))}
    </div>
  )
}
