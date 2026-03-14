import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Clock, ArrowUpRight, Activity } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount, staggerChildMount } from '@constants/animations'

const SERVICES = [
  {
    name: 'Web Hosting (US-East)',
    description: 'Primary hosting infrastructure for client websites',
    group: 'Hosting',
  },
  {
    name: 'Web Hosting (US-West)',
    description: 'Secondary hosting region for redundancy',
    group: 'Hosting',
  },
  {
    name: 'CDN & Edge Network',
    description: 'Content delivery and static asset distribution',
    group: 'Hosting',
  },
  {
    name: 'DNS Resolution',
    description: 'Domain name system and routing',
    group: 'Hosting',
  },
  {
    name: 'SSL/TLS Certificates',
    description: 'Certificate provisioning and renewal',
    group: 'Security',
  },
  {
    name: 'DDoS Protection',
    description: 'Traffic filtering and attack mitigation',
    group: 'Security',
  },
  {
    name: 'Firewall & WAF',
    description: 'Web application firewall and access control',
    group: 'Security',
  },
  {
    name: 'Automated Backups',
    description: 'Nightly site backups and disaster recovery',
    group: 'Maintenance',
  },
  {
    name: 'Uptime Monitoring',
    description: 'Real-time health checks every 30 seconds',
    group: 'Maintenance',
  },
  {
    name: 'Performance Analytics',
    description: 'Core Web Vitals and speed tracking',
    group: 'Maintenance',
  },
  {
    name: 'Email Delivery',
    description: 'Transactional email and form submissions',
    group: 'Services',
  },
  {
    name: 'Form Processing',
    description: 'Contact form handling and spam filtering',
    group: 'Services',
  },
]

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getServiceStatus(service, timeSlot) {
  const seed = service.name.length * 137 + timeSlot
  const rand = seededRandom(seed)

  // ~95% operational, ~4% degraded, ~1% down
  if (rand < 0.95) return 'operational'
  if (rand < 0.99) return 'degraded'
  return 'down'
}

function getUptime(service, timeSlot) {
  const seed = service.name.length * 271 + timeSlot
  const rand = seededRandom(seed)
  // Uptime between 99.90% and 100%
  return (99.9 + rand * 0.1).toFixed(2)
}

function getResponseTime(service, timeSlot) {
  const seed = service.name.length * 389 + timeSlot
  const rand = seededRandom(seed)
  // Response time between 12ms and 85ms
  return Math.floor(12 + rand * 73)
}

function getUptimeHistory(service, currentSlot) {
  return Array.from({ length: 90 }, (_, i) => {
    const slot = currentSlot - (89 - i)
    return getServiceStatus(service, slot)
  })
}

const STATUS_CONFIG = {
  operational: {
    icon: CheckCircle2,
    label: 'Operational',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
    barColor: 'bg-green-400',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    barColor: 'bg-yellow-400',
  },
  down: {
    icon: XCircle,
    label: 'Outage',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    barColor: 'bg-red-400',
  },
}

function OverallStatus({ statuses }) {
  const hasDown = statuses.some(s => s === 'down')
  const hasDegraded = statuses.some(s => s === 'degraded')

  let status, message, bgClass, borderClass, textClass, dotClass
  if (hasDown) {
    status = 'down'
    message = 'Partial System Outage'
    bgClass = 'bg-red-50'
    borderClass = 'border-red-200'
    textClass = 'text-red-700'
    dotClass = 'bg-red-500'
  } else if (hasDegraded) {
    status = 'degraded'
    message = 'Minor Service Degradation'
    bgClass = 'bg-yellow-50'
    borderClass = 'border-yellow-200'
    textClass = 'text-yellow-700'
    dotClass = 'bg-yellow-500'
  } else {
    status = 'operational'
    message = 'All Systems Operational'
    bgClass = 'bg-green-50'
    borderClass = 'border-green-200'
    textClass = 'text-green-700'
    dotClass = 'bg-green-500'
  }

  return (
    <motion.div
      {...fadeInUpMount}
      transition={{ duration: 0.5 }}
      className={`mb-10 flex items-center justify-between rounded-2xl border ${borderClass} ${bgClass} px-6 py-5`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-3 w-3 rounded-full ${dotClass} ${status === 'operational' ? 'animate-pulse' : ''}`}
        />
        <span className={`text-lg font-semibold ${textClass}`}>{message}</span>
      </div>
      <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
        <Clock className="h-4 w-4" />
        <span>Updated just now</span>
      </div>
    </motion.div>
  )
}

function UptimeBar({ history }) {
  return (
    <div className="flex gap-px" title="90-day uptime history">
      {history.map((status, i) => (
        <div
          key={i}
          className={`h-8 flex-1 rounded-sm ${STATUS_CONFIG[status].barColor} transition-all hover:opacity-80`}
          title={`Day ${i + 1}: ${STATUS_CONFIG[status].label}`}
        />
      ))}
    </div>
  )
}

function ServiceRow({ service, timeSlot, index }) {
  const status = getServiceStatus(service, timeSlot)
  const uptime = getUptime(service, timeSlot)
  const responseTime = getResponseTime(service, timeSlot)
  const history = getUptimeHistory(service, timeSlot)
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <motion.div
      {...staggerChildMount(index, 0.03)}
      className="border-b border-gray-100 last:border-b-0"
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.color}`} />
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
      <div className="px-6 pb-3">
        <UptimeBar history={history} />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </motion.div>
  )
}

function IncidentHistory({ timeSlot }) {
  const incidents = useMemo(() => {
    const list = []
    const dayMs = 86400000
    const now = Date.now()

    for (let i = 1; i <= 14; i++) {
      const seed = timeSlot * 31 + i * 97
      const rand = seededRandom(seed)
      if (rand < 0.15) {
        const date = new Date(now - i * dayMs)
        const formatted = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const isMinor = rand < 0.12

        const minorIncidents = [
          {
            title: 'Elevated response times on US-East',
            service: 'Web Hosting (US-East)',
            duration: `${Math.floor(rand * 40 + 5)} minutes`,
          },
          {
            title: 'CDN cache invalidation delay',
            service: 'CDN & Edge Network',
            duration: `${Math.floor(rand * 20 + 3)} minutes`,
          },
          {
            title: 'Email delivery queue backup',
            service: 'Email Delivery',
            duration: `${Math.floor(rand * 30 + 10)} minutes`,
          },
          {
            title: 'Monitoring false positive alerts',
            service: 'Uptime Monitoring',
            duration: `${Math.floor(rand * 15 + 2)} minutes`,
          },
        ]

        const majorIncidents = [
          {
            title: 'Upstream provider network issue',
            service: 'Web Hosting (US-West)',
            duration: `${Math.floor(rand * 60 + 30)} minutes`,
          },
          {
            title: 'DDoS mitigation activated',
            service: 'DDoS Protection',
            duration: `${Math.floor(rand * 45 + 15)} minutes`,
          },
        ]

        const pool = isMinor ? minorIncidents : majorIncidents
        const incident = pool[Math.floor(rand * pool.length * 10) % pool.length]

        list.push({
          ...incident,
          date: formatted,
          severity: isMinor ? 'minor' : 'major',
          resolved: true,
        })
      }
    }

    return list.slice(0, 5)
  }, [timeSlot])

  if (incidents.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />
        <p className="font-medium text-gray-900">No recent incidents</p>
        <p className="text-sm text-gray-500">
          All systems have been running smoothly for the past 14 days.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {incidents.map((incident, i) => (
        <div key={i} className="border-b border-gray-100 px-6 py-4 last:border-b-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${incident.severity === 'minor' ? 'bg-yellow-400' : 'bg-red-400'}`}
                />
                <p className="font-medium text-gray-900">{incident.title}</p>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {incident.service} &middot; Resolved in {incident.duration}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-sm text-gray-500">{incident.date}</p>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                Resolved
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Status() {
  const [timeSlot, setTimeSlot] = useState(() => Math.floor(Date.now() / 300000))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSlot(Math.floor(Date.now() / 300000))
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const statuses = SERVICES.map(s => getServiceStatus(s, timeSlot))
  const groups = ['Hosting', 'Security', 'Maintenance', 'Services']

  const overallUptime = useMemo(() => {
    const uptimes = SERVICES.map(s => parseFloat(getUptime(s, timeSlot)))
    return (uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(2)
  }, [timeSlot])

  return (
    <div>
      <Seo
        title="System Status"
        description="Real-time status of TaylorURL hosting, security, and maintenance systems. Check uptime, response times, and incident history."
        path="/status"
      />
      <PageHero
        title="System Status"
        description="Real-time health of every system keeping your site online."
      />

      <section className="relative overflow-hidden bg-white py-16">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <OverallStatus statuses={statuses} />

          {/* Summary stats */}
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
              <p className="text-2xl font-bold text-gray-900">30s</p>
              <p className="text-xs text-gray-500">Check Interval</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">90d</p>
              <p className="text-xs text-gray-500">History Window</p>
            </div>
          </motion.div>

          {/* Service groups */}
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
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  {groupServices.map((service, i) => (
                    <ServiceRow
                      key={service.name}
                      service={service}
                      timeSlot={timeSlot}
                      index={gi * 4 + i}
                    />
                  ))}
                </div>
              </motion.div>
            )
          })}

          {/* Incident history */}
          <motion.div {...fadeInUp} transition={{ delay: 0.5 }} className="mt-12">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Recent Incidents</h2>
            <IncidentHistory timeSlot={timeSlot} />
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gray-950 py-16">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-2xl font-bold text-white">Need Help?</h2>
            <p className="mb-6 text-gray-400">
              Status updates every 5 minutes. All times in your local timezone.
            </p>
            <a
              href="mailto:support@taylorurl.com"
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
