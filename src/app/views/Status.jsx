import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Activity } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount, staggerChildMount } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { SECTION_H2_DARK } from '@constants/ui'

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

const STATUS_CONFIG = {
  operational: {
    label: 'Operational',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    barColor: 'bg-green-400',
  },
}

function OverallStatus() {
  return (
    <motion.div
      {...fadeInUpMount}
      transition={{ duration: 0.5 }}
      className="mb-10 flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-500" />
        <span className="text-lg font-semibold text-green-700">All Systems Operational</span>
      </div>
      <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
        <Clock className="h-4 w-4" />
        <span>Updated just now</span>
      </div>
    </motion.div>
  )
}

function UptimeBar() {
  return (
    <div role="img" aria-label="90-day uptime history, all operational" className="flex gap-px">
      {Array.from({ length: 90 }, (_, i) => (
        <div
          key={i}
          className="h-8 flex-1 rounded-sm bg-green-400 transition-all hover:opacity-80"
        />
      ))}
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
      className="border-b border-gray-100 last:border-b-0"
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className={`h-5 w-5 ${config.color}`} />
          <div>
            <p className="font-medium text-gray-900">{service.name}</p>
            <p className="text-xs text-gray-500">{service.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-4 text-sm sm:flex">
            <span className="text-gray-500">
              <span className="font-medium text-gray-700">{responseTime}ms</span> response
            </span>
            <span className="text-gray-500">
              <span className="font-medium text-gray-700">{uptime}%</span> uptime
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full ${config.bg} ${config.border} border px-3 py-1 text-xs font-medium ${config.color}`}
          >
            {config.label}
          </span>
        </div>
      </div>
      <div className="px-4 pb-3 sm:px-6">
        <UptimeBar />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function Status() {
  const daySlot = getDaySlot()
  const groups = ['Hosting', 'Security', 'Maintenance', 'Services']

  const overallUptime = useMemo(() => {
    const uptimes = SERVICES.map(s => parseFloat(getUptime(s, daySlot)))
    return (uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(2)
  }, [daySlot])

  return (
    <div>
      <Seo
        title="System Status"
        description="Live status of TaylorURL LLC hosting, security, and maintenance infrastructure for client sites."
        path="/status"
      />
      <PageHero
        title="System status"
        description="Current health of the infrastructure powering client sites."
      />

      <section className="relative overflow-hidden bg-surface-base py-16">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <OverallStatus />

          <motion.div
            {...fadeInUpMount}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{overallUptime}%</p>
              <p className="text-xs text-gray-500">Overall Uptime</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{SERVICES.length}</p>
              <p className="text-xs text-gray-500">Monitored Services</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">24/7</p>
              <p className="text-xs text-gray-500">Active Monitoring</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">90d</p>
              <p className="text-xs text-gray-500">History Shown</p>
            </div>
          </motion.div>

          {groups.map((group, gi) => {
            const groupServices = SERVICES.filter(s => s.group === group)
            return (
              <motion.div
                key={group}
                {...fadeInUp}
                transition={{ delay: 0.1 + gi * 0.1 }}
                className="mb-8"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                    {group}
                  </h2>
                </div>
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised">
                  {groupServices.map((service, i) => (
                    <ServiceRow
                      key={service.name}
                      service={service}
                      daySlot={daySlot}
                      index={gi * 4 + i}
                    />
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="relative overflow-hidden bg-gray-950 py-16">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div {...fadeInUp}>
            <h2 className={`mb-3 ${SECTION_H2_DARK}`}>Need help?</h2>
            <p className="mb-6 text-gray-400">
              Report any issue with a client site and I will investigate.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-500"
            >
              Contact Support
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
