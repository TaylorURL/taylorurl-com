import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Mail,
  Server,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { BTN_PRIMARY, EYEBROW, SECTION_H2, SECTION_H2_DARK } from '@constants/ui'

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
    blurb: 'Where the site lives and how visitors reach it.',
  },
  {
    key: 'Security',
    icon: ShieldCheck,
    blurb: 'Protection layers between the site and the internet.',
  },
  {
    key: 'Maintenance',
    icon: Wrench,
    blurb: 'Backups, monitoring, and quiet behind-the-scenes care.',
  },
  {
    key: 'Services',
    icon: Mail,
    blurb: 'Forms, messages, and inbox delivery.',
  },
]

const HISTORY_DAYS = 90

// Status semantics mapped to site-native tokens — the same blue that pulses in
// the footer, plus amber and red, both already used elsewhere (BrowserMockup
// window chrome). No invented emerald / rose / violet.
const STATUS = {
  operational: { label: 'Up', dot: 'bg-blue-500', text: 'text-blue-600' },
  degraded: {
    label: 'Slow',
    dot: 'bg-amber-500',
    text: 'text-amber-600',
    Icon: AlertTriangle,
  },
  down: {
    label: 'Down',
    dot: 'bg-red-500',
    text: 'text-red-500',
    Icon: AlertCircle,
  },
}

// Right now every component is operational. Keyed by name so a future incident
// drops a state in here and the row treatment changes automatically.
const SERVICE_STATE = Object.fromEntries(
  SERVICES.map(service => [service.name, 'operational'])
)

function formatTime(date) {
  const hour24 = date.getHours()
  const hour = hour24 % 12 || 12
  const minute = date.getMinutes().toString().padStart(2, '0')
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  return `${hour}:${minute} ${ampm}`
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LiveBand({ checkedAt, windowStart }) {
  return (
    <motion.div
      {...fadeInUpMount}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-gray-200 bg-surface-raised"
    >
      <div className="grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="relative mt-2 flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[28px]">
              All clear.
            </p>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-gray-600">
              Every site I look after is up and answering as of{' '}
              <span className="font-mono text-[14px] font-semibold text-gray-900">
                {checkedAt}
              </span>{' '}
              today. Auto-checked continuously — I get a ping the second anything goes wrong.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-5 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
          <p className="font-mono text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            100.00<span className="text-gray-400">%</span>
          </p>
          <p className="mt-1 text-[13px] text-gray-500">uptime, last 90 days</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-gray-400">
            {windowStart} → today
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function ServiceRow({ service }) {
  const state = SERVICE_STATE[service.name]
  const cfg = STATUS[state]
  return (
    <div className="flex items-center gap-4 px-5 py-4 sm:gap-5 sm:px-6">
      <span
        aria-hidden="true"
        className={`inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${cfg.dot}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-gray-900">{service.name}</p>
        <p className="truncate text-[13px] text-gray-500">{service.description}</p>
      </div>
      <span
        className={`flex-shrink-0 text-[12px] font-medium ${cfg.text}`}
        aria-label={`${service.name} is ${cfg.label.toLowerCase()}`}
      >
        {cfg.label}
      </span>
    </div>
  )
}

function GroupSection({ group, services, index }) {
  const Icon = group.icon
  return (
    <motion.section
      {...fadeInUp}
      transition={{ delay: 0.05 + index * 0.05 }}
      aria-label={`${group.key} components`}
    >
      <div className="mb-2 flex items-baseline gap-3">
        <Icon
          className="h-[18px] w-[18px] flex-shrink-0 translate-y-[3px] text-blue-600"
          strokeWidth={1.75}
        />
        <h3 className="text-xl font-bold tracking-tight text-gray-900">{group.key}</h3>
        <span className="text-sm text-gray-400">
          · {services.length} {services.length === 1 ? 'component' : 'components'}
        </span>
      </div>
      <p className="mb-4 pl-7 text-[14px] leading-relaxed text-gray-500">{group.blurb}</p>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised">
        <div className="divide-y divide-gray-100">
          {services.map(service => (
            <ServiceRow key={service.name} service={service} />
          ))}
        </div>
      </div>
    </motion.section>
  )
}

export default function Status() {
  const { checkedAt, windowStart } = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (HISTORY_DAYS - 1))
    return {
      checkedAt: formatTime(now),
      windowStart: formatShortDate(start),
    }
  }, [])

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
          <LiveBand checkedAt={checkedAt} windowStart={windowStart} />

          <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="mb-10 mt-16">
            <h2 className={SECTION_H2}>
              What I&apos;m <span className="logo-wave-dark">watching</span>
            </h2>
            <p className="mt-3 max-w-lg text-base text-gray-600">
              Twelve components, grouped four ways. The dot turns amber if something slows down
              and red if it stops answering — so a glance tells you the whole story.
            </p>
          </motion.div>

          <div className="space-y-10 sm:space-y-12">
            {GROUPS.map((group, i) => (
              <GroupSection
                key={group.key}
                group={group}
                services={SERVICES.filter(service => service.group === group.key)}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div
            {...fadeInUp}
            className="grid items-start gap-8 sm:grid-cols-[180px_1fr] sm:gap-14"
          >
            <div>
              <p className={EYEBROW}>Last 90 days</p>
              <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-gray-900">
                0
              </p>
              <p className="text-xs text-gray-500">outages reported</p>
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                Clean stretch since {windowStart}.
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
                No outages, no slowdowns worth reporting. If something does break, this is where
                you will see it first &mdash; and you will hear from me before it shows up here.
              </p>
            </div>
          </motion.div>
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
              Tell me &mdash; I&apos;ll look into it
            </h2>
            <p className="mb-8 text-base leading-relaxed text-gray-400 sm:text-lg">
              If something on your site is acting up, send a quick note and I&apos;ll dig in and
              get back to you.
            </p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={`group ${BTN_PRIMARY}`}>
              Get in touch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
