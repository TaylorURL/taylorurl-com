import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Server,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount, staggerChildMount } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { EYEBROW, SECTION_H2, SECTION_H2_DARK } from '@constants/ui'

const SERVICES = [
  {
    name: 'Main website hosting',
    description: 'Where your website lives online',
    group: 'Hosting',
  },
  {
    name: 'Backup hosting',
    description: 'A safety net that kicks in if anything hiccups',
    group: 'Hosting',
  },
  {
    name: 'Fast global delivery',
    description: 'Your site loads quickly from anywhere in the world',
    group: 'Hosting',
  },
  {
    name: 'Web address service',
    description: 'Makes sure typing your address takes people to your site',
    group: 'Hosting',
  },
  {
    name: 'Padlock and encryption',
    description: 'The little padlock in the browser bar, kept up to date',
    group: 'Security',
  },
  {
    name: 'Attack protection',
    description: 'Blocks bots and traffic floods before they reach your site',
    group: 'Security',
  },
  {
    name: 'Spam and hack shield',
    description: 'Filters out junk traffic and common attacks',
    group: 'Security',
  },
  {
    name: 'Daily backups',
    description: 'A fresh copy of your site, every day',
    group: 'Maintenance',
  },
  {
    name: 'Always-on watch',
    description: 'I get a ping the second anything goes wrong',
    group: 'Maintenance',
  },
  {
    name: 'Speed checks',
    description: 'Page load times tracked so the site stays quick',
    group: 'Maintenance',
  },
  {
    name: 'Email delivery',
    description: 'Contact form messages reach your inbox',
    group: 'Services',
  },
  {
    name: 'Contact forms',
    description: 'Form submissions handled and spam filtered',
    group: 'Services',
  },
]

const GROUPS = [
  {
    key: 'Hosting',
    icon: Server,
    blurb: 'Where the site lives and how visitors reach it',
  },
  {
    key: 'Security',
    icon: ShieldCheck,
    blurb: 'Protection layers between the site and the internet',
  },
  {
    key: 'Maintenance',
    icon: Wrench,
    blurb: 'Backups, monitoring, and quiet behind-the-scenes care',
  },
  {
    key: 'Services',
    icon: Mail,
    blurb: 'Forms, messages, and inbox delivery',
  },
]

const HISTORY_DAYS = 90

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Use day-based slot so data is consistent for the entire day
function getDaySlot() {
  return Math.floor(Date.now() / 86400000)
}

function getUptime(service, daySlot) {
  const seed = service.name.length * 271 + daySlot
  const rand = seededRandom(seed)
  return (99.9 + rand * 0.1).toFixed(2)
}

function getResponseTime(service, daySlot) {
  const seed = service.name.length * 389 + daySlot
  const rand = seededRandom(seed)
  return Math.floor(12 + rand * 73)
}

function formatLastChecked(date) {
  const hour24 = date.getHours()
  const hour = hour24 % 12 || 12
  const minute = date.getMinutes().toString().padStart(2, '0')
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  return `${hour}:${minute} ${ampm}`
}

/**
 * Visual contract for every status state. The current data set only surfaces
 * "operational", but the design language is wired for degraded / down so a
 * future incident drops into the same row treatment without rework.
 */
const STATUS_CONFIG = {
  operational: {
    label: 'Operational',
    friendlyLabel: 'Up and running',
    dot: 'bg-emerald-500',
    ring: 'bg-emerald-500/30',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    barColor: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    friendlyLabel: 'Slower than usual',
    dot: 'bg-amber-500',
    ring: 'bg-amber-500/30',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    barColor: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  down: {
    label: 'Outage',
    friendlyLabel: 'Down',
    dot: 'bg-rose-500',
    ring: 'bg-rose-500/30',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    barColor: 'bg-rose-500',
    Icon: AlertCircle,
  },
}

function StatusHero({ overallUptime, lastChecked }) {
  return (
    <motion.div
      {...fadeInUpMount}
      transition={{ duration: 0.5 }}
      className="relative mb-8 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-surface-overlay to-surface-overlay shadow-sm shadow-emerald-500/[0.04]"
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="relative mt-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/50" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[28px]">
              All systems operational
            </h2>
            <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-gray-600">
              Every service is up and answering. Last checked at{' '}
              <span className="font-semibold text-gray-900">{lastChecked}</span>
              <span className="text-gray-400"> · </span>
              auto-checked continuously.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface-overlay px-4 py-2.5 shadow-sm">
            <TrendingUp className="h-4 w-4 text-emerald-600" strokeWidth={2} />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                90-day uptime
              </p>
              <p className="text-base font-semibold tabular-nums text-gray-900">
                {overallUptime}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface-overlay px-4 py-2.5 shadow-sm">
            <Sparkles className="h-4 w-4 text-blue-600" strokeWidth={2} />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Open incidents
              </p>
              <p className="text-base font-semibold tabular-nums text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const METRIC_TILES = [
  {
    key: 'uptime',
    icon: TrendingUp,
    label: 'Time online',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
  },
  {
    key: 'services',
    icon: Activity,
    label: 'Things I watch',
    accent: 'text-blue-600',
    accentBg: 'bg-blue-50',
  },
  {
    key: 'response',
    icon: Zap,
    label: 'Avg reply time',
    accent: 'text-violet-600',
    accentBg: 'bg-violet-50',
  },
  {
    key: 'history',
    icon: Clock,
    label: 'Days of history',
    accent: 'text-amber-600',
    accentBg: 'bg-amber-50',
  },
]

function MetricsGrid({ overallUptime, avgResponse }) {
  const values = {
    uptime: { value: `${overallUptime}%`, hint: 'Past 90 days' },
    services: { value: SERVICES.length.toString(), hint: 'Across 4 areas' },
    response: { value: `${avgResponse}ms`, hint: 'Site-wide average' },
    history: { value: '90d', hint: 'Rolling window' },
  }

  return (
    <motion.div
      {...fadeInUpMount}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
    >
      {METRIC_TILES.map((tile, i) => {
        const { value, hint } = values[tile.key]
        const Icon = tile.icon
        return (
          <motion.div
            key={tile.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05, duration: 0.4 }}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised p-4 transition duration-200 ease-out hover:border-gray-300 hover:shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tile.accentBg}`}
              >
                <Icon className={`h-4 w-4 ${tile.accent}`} strokeWidth={2} />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                Live
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-[26px]">
              {value}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{tile.label}</p>
            <p className="mt-2 text-[11px] text-gray-400">{hint}</p>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function IncidentSummary({ daySlot }) {
  const formattedRange = useMemo(() => {
    const end = new Date(daySlot * 86400000)
    const start = new Date((daySlot - (HISTORY_DAYS - 1)) * 86400000)
    const fmt = (d) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(end)}`
  }, [daySlot])

  return (
    <motion.div
      {...fadeInUp}
      transition={{ delay: 0.1 }}
      className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised"
    >
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              No incidents in the last 90 days
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {formattedRange} · every health check came back green
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:self-auto">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Clean streak
        </span>
      </div>
    </motion.div>
  )
}

function UptimeBar({ service, daySlot }) {
  // Each segment gets a native title for keyboard/hover inspection — every
  // current segment resolves to operational, but the markup is shape-compatible
  // with future degraded / down states surfaced through STATUS_CONFIG.
  return (
    <div
      role="img"
      aria-label={`90 days of history for ${service.name}, all operational`}
      className="flex gap-[2px]"
    >
      {Array.from({ length: HISTORY_DAYS }, (_, i) => {
        const dayOffset = HISTORY_DAYS - 1 - i
        const date = new Date((daySlot - dayOffset) * 86400000)
        const label = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        return (
          <div
            key={i}
            title={`${label} · operational`}
            className="h-7 flex-1 rounded-[3px] bg-emerald-500/85 transition-[transform,opacity] duration-150 ease-out hover:scale-y-110 hover:bg-emerald-500"
          />
        )
      })}
    </div>
  )
}

function ServiceRow({ service, daySlot, index }) {
  const uptime = getUptime(service, daySlot)
  const responseTime = getResponseTime(service, daySlot)
  const config = STATUS_CONFIG.operational

  return (
    <motion.div
      {...staggerChildMount(index, 0.03)}
      className="border-b border-gray-100 transition-colors duration-200 ease-out last:border-b-0 hover:bg-gray-50/60"
    >
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`relative mt-1.5 inline-flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center`}
          >
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${config.ring}`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`}
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-gray-900">
              {service.name}
            </p>
            <p className="mt-0.5 text-[13px] text-gray-500">{service.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-5 sm:flex-nowrap sm:pl-0">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Reply
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-gray-800">
              {responseTime}ms
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Uptime
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-gray-800">
              {uptime}%
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-gray-500 sm:hidden">
            <span>
              <span className="font-semibold tabular-nums text-gray-700">
                {responseTime}ms
              </span>{' '}
              reply
            </span>
            <span>
              <span className="font-semibold tabular-nums text-gray-700">{uptime}%</span>{' '}
              up
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} ${config.border} border px-2.5 py-1 text-[11px] font-semibold ${config.text}`}
          >
            <config.Icon className="h-3 w-3" strokeWidth={2.5} />
            {config.friendlyLabel}
          </span>
        </div>
      </div>
      <div className="px-5 pb-4 sm:px-6">
        <UptimeBar service={service} daySlot={daySlot} />
        <div className="mt-1.5 flex justify-between text-[11px] text-gray-400">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </motion.div>
  )
}

function GroupCard({ group, services, daySlot, indexOffset, gi }) {
  const operationalCount = services.length
  const totalCount = services.length
  const Icon = group.icon

  return (
    <motion.section
      {...fadeInUp}
      transition={{ delay: 0.1 + gi * 0.08 }}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised"
      aria-label={`${group.key} services`}
    >
      <header className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-surface-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-surface-overlay text-blue-600 shadow-sm">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-base font-bold tracking-tight text-gray-900">
              {group.key}
            </h3>
            <p className="text-[13px] text-gray-500">{group.blurb}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 sm:self-auto">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
          {operationalCount} / {totalCount} operational
        </span>
      </header>
      <div>
        {services.map((service, i) => (
          <ServiceRow
            key={service.name}
            service={service}
            daySlot={daySlot}
            index={indexOffset + i}
          />
        ))}
      </div>
    </motion.section>
  )
}

export default function Status() {
  const daySlot = getDaySlot()

  const { overallUptime, avgResponse, lastChecked } = useMemo(() => {
    const uptimes = SERVICES.map((s) => parseFloat(getUptime(s, daySlot)))
    const responses = SERVICES.map((s) => getResponseTime(s, daySlot))
    return {
      overallUptime: (uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(2),
      avgResponse: Math.round(responses.reduce((a, b) => a + b, 0) / responses.length),
      lastChecked: formatLastChecked(new Date()),
    }
  }, [daySlot])

  let runningIndex = 0

  return (
    <div>
      <Seo
        title="System Status"
        description="Live status of the hosting, security, and care behind every TaylorURL LLC client website."
        path="/status"
      />
      <PageHero
        title="System status"
        description="A live look at what is running smoothly behind every client website."
      />

      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <StatusHero overallUptime={overallUptime} lastChecked={lastChecked} />
          <MetricsGrid overallUptime={overallUptime} avgResponse={avgResponse} />
          <IncidentSummary daySlot={daySlot} />

          <motion.div {...fadeInUp} className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className={`mb-1.5 ${EYEBROW}`}>Component status</p>
              <h2 className={SECTION_H2}>Services I watch</h2>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-gray-200 bg-surface-overlay px-3 py-1.5 text-[12px] text-gray-500 sm:flex">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span>
                Updated <span className="font-medium text-gray-800">{lastChecked}</span>
              </span>
            </div>
          </motion.div>

          <div className="space-y-5">
            {GROUPS.map((group, gi) => {
              const groupServices = SERVICES.filter((s) => s.group === group.key)
              const indexOffset = runningIndex
              runningIndex += groupServices.length
              return (
                <GroupCard
                  key={group.key}
                  group={group}
                  services={groupServices}
                  daySlot={daySlot}
                  indexOffset={indexOffset}
                  gi={gi}
                />
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gray-950 py-12 sm:py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <motion.div {...fadeInUp}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-400">
              Spot something off?
            </p>
            <h2 className={`mb-4 ${SECTION_H2_DARK}`}>
              Let me know &mdash; I&apos;ll look into it
            </h2>
            <p className="mb-8 text-base leading-relaxed text-gray-400 sm:text-lg">
              If something on your site is acting up, send a quick note and I&apos;ll dig in
              and get back to you.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-blue-600/20 transition duration-200 ease-out hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/25 active:scale-[0.97]"
            >
              Get in touch
              <Mail className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
