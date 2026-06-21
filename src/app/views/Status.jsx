import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Mail,
  Server,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { useScrollParallax } from '@hooks/useScrollParallax'

const SERVICES = [
  {
    name: 'Main website hosting',
    description: 'Where your website lives online',
    group: 'Hosting',
  },
  {
    name: 'Backup hosting',
    description: 'A safety net that kicks in if anything goes sideways',
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
    description: 'The padlock in the browser bar, kept up to date',
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
    blurb: 'Where the site lives and how visitors get to it.',
  },
  {
    key: 'Security',
    icon: ShieldCheck,
    blurb: 'The layers between your site and the rest of the internet.',
  },
  {
    key: 'Maintenance',
    icon: Wrench,
    blurb: 'Backups, monitoring, and quiet care in the background.',
  },
  {
    key: 'Services',
    icon: Mail,
    blurb: 'Forms, messages, and getting them into your inbox.',
  },
]

const HISTORY_DAYS = 90

const STATUS = {
  operational: {
    label: 'Up',
    dot: 'bg-accent',
    text: 'text-accent',
  },
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
  // Scroll-driven uptime column — drifts up against the static status copy as
  // the band scrolls past, so the big "100.00%" feels like it's catching the
  // user's eye instead of sitting flat with the rest of the card.
  const { ref, transform } = useScrollParallax({ range: [40, -40] })

  return (
    <motion.div
      ref={ref}
      {...fadeInUpMount}
      className="grid gap-px overflow-hidden border border-hair-paper bg-hair-paper lg:grid-cols-[1.6fr_1fr]"
    >
      <div className="flex flex-col gap-6 bg-paper p-8 sm:p-10">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="relative mt-2 flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              // All sites up
            </p>
            <p className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.04] tracking-tightest text-ink-paper">
              All clear.
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper-soft">
              Every site I look after is up and running as of{' '}
              <span className="font-mono text-[14px] font-semibold text-ink-paper">
                {checkedAt}
              </span>{' '}
              today. Checked around the clock — I get a ping the second anything goes wrong.
            </p>
          </div>
        </div>
      </div>

      <motion.div
        style={{ transform }}
        className="flex flex-col justify-center gap-3 bg-paper p-8 will-change-transform sm:p-10"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
          // Uptime · 90 days
        </p>
        <p className="font-mono text-[clamp(2.4rem,5vw,3.4rem)] font-semibold leading-none text-ink-paper">
          100.00<span className="text-paper-faint">%</span>
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
          {windowStart} → today
        </p>
      </motion.div>
    </motion.div>
  )
}

function ServiceRow({ service }) {
  const state = SERVICE_STATE[service.name]
  const cfg = STATUS[state]
  return (
    <div className="flex items-center gap-4 bg-paper px-5 py-4 sm:gap-5 sm:px-6">
      <span
        aria-hidden="true"
        className={`inline-flex h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink-paper">{service.name}</p>
        <p className="truncate text-[12px] text-paper-soft">{service.description}</p>
      </div>
      <span
        className={`flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] ${cfg.text}`}
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
      <div className="mb-4 flex items-baseline gap-4 border-b border-hair-paper pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
          {String(index + 1).padStart(2, '0')}
        </span>
        <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <h3 className="text-[18px] font-semibold tracking-tight text-ink-paper sm:text-[20px]">
          {group.key}
        </h3>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
          {String(services.length).padStart(2, '0')} comp
        </span>
      </div>
      <p className="mb-4 max-w-2xl text-[14px] leading-relaxed text-paper-soft">
        {group.blurb}
      </p>
      <div className="overflow-hidden border border-hair-paper">
        <div className="divide-y divide-hair-paper">
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
        description="Live status of the hosting, security, and care behind every TaylorURL client website."
        path="/status"
      />
      <PageHero
        eyebrow="// 01 — Status"
        title="A live look at every system."
        description="Twelve things I watch around the clock. Green means up, amber means slow, red means down — so a glance tells you the whole story."
      />

      <section className="relative overflow-hidden bg-paper py-20 sm:py-28">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1080px] px-6 sm:px-10 lg:px-16">
          <LiveBand checkedAt={checkedAt} windowStart={windowStart} />

          <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="mb-12 mt-20">
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              // 02 — What I watch
            </p>
            <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink-paper">
              What I&apos;m watching.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-paper-soft">
              Four groups, twelve checks. Each row shows its own state — and the band up
              top changes color the moment any one of them does.
            </p>
          </motion.div>

          <div className="space-y-14 sm:space-y-16">
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

      <section className="relative overflow-hidden border-t border-hair bg-bg py-20 text-ink sm:py-28">
        <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1080px] px-6 sm:px-10 lg:px-16">
          <motion.div
            {...fadeInUp}
            className="grid items-start gap-8 sm:grid-cols-[200px_1fr] sm:gap-14"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                Last 90 days
              </p>
              <p className="mt-4 font-mono text-[clamp(2.6rem,4.6vw,3.6rem)] font-semibold tabular-nums leading-none text-ink">
                0
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                outages reported
              </p>
            </div>
            <div>
              <h3 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-tightest text-ink">
                Clean stretch since {windowStart}.
              </h3>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                No outages and no slowdowns worth reporting. If something does break, this
                is where you’ll see it first — and you’ll hear from me before it ever shows
                up here.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-hair bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="pointer-events-none absolute right-0 top-0 h-72 w-72 -translate-y-1/3 translate-x-1/4 rounded-full bg-accent/12 blur-3xl"
          aria-hidden="true"
        />
        <motion.div
          {...fadeInUp}
          className="relative mx-auto w-full max-w-[920px] px-6 text-center sm:px-10"
        >
          <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
            <span className="h-px w-8 bg-accent" />
            // Spot something off?
            <span className="h-px w-8 bg-accent" />
          </p>
          <h2 className="text-[clamp(2rem,4.6vw,3.2rem)] font-semibold leading-[1.04] tracking-tightest text-ink">
            Tell me — I&apos;ll <span className="text-accent">look into it</span>.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            If something on your site is acting up, send a quick message. I&apos;ll dig in
            and get back to you.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="group mt-10 inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
          >
            Get in touch
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </motion.div>
      </section>
    </div>
  )
}
