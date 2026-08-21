import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, ArrowUpRight, Check, Radio, WifiOff } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, fadeInUpMount } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { useScrollParallax } from '@hooks/useScrollParallax'
import { useStatusFeed } from '@hooks/useStatusFeed'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import CountUp from '@reactbits/CountUp/CountUp'
import DecryptedText from '@reactbits/DecryptedText/DecryptedText'
import Magnet from '@reactbits/Magnet/Magnet'
import { AccentGradient } from '@reactbits/kit'

const EYEBROW_DECRYPT = { animateOn: 'view', sequential: true, speed: 40, maxIterations: 12 }

const SITE_STATE = {
  operational: { label: 'Up', dot: 'bg-accent', text: 'text-accent' },
  degraded: { label: 'Issue', dot: 'bg-amber-500', text: 'text-amber-600', Icon: AlertTriangle },
  outage: { label: 'Down', dot: 'bg-red-500', text: 'text-red-500', Icon: AlertCircle },
}

const OVERALL = {
  operational: {
    eyebrow: '// All sites up',
    title: 'All clear.',
    body: 'Every site I look after is answering right now.',
    dot: 'bg-accent',
    ping: 'bg-accent/60',
  },
  degraded: {
    eyebrow: '// Something needs attention',
    title: 'Working on it.',
    body: 'Every site is reachable, but at least one has an issue being worked. Details below.',
    dot: 'bg-amber-500',
    ping: 'bg-amber-500/60',
  },
  outage: {
    eyebrow: '// Outage in progress',
    title: 'Something is down.',
    body: 'At least one site is not answering. I already know, and the details are below.',
    dot: 'bg-red-500',
    ping: 'bg-red-500/60',
  },
  unknown: {
    eyebrow: '// Checking',
    title: 'Taking a look.',
    body: 'Pulling the latest checks now.',
    dot: 'bg-paper-soft',
    ping: 'bg-paper-soft/40',
  },
}

const INCIDENT_STATE = {
  investigating: { label: 'Investigating', tone: 'text-amber-600', bar: 'bg-amber-500' },
  identified: { label: 'Fix In Progress', tone: 'text-amber-600', bar: 'bg-amber-500' },
  resolved: { label: 'Resolved', tone: 'text-accent', bar: 'bg-accent' },
}

function formatClock(date) {
  if (!date) return ''
  const hour24 = date.getHours()
  const hour = hour24 % 12 || 12
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute} ${hour24 >= 12 ? 'PM' : 'AM'}`
}

function formatDay(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWhen(value) {
  const date = new Date(value)
  return `${formatDay(date)}, ${formatClock(date)}`
}

function relative(from, now) {
  if (!from) return ''
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function Eyebrow({ children, className = '' }) {
  return (
    <p
      className={`mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent ${className}`}
    >
      <span className="h-px w-8 bg-accent" />
      <DecryptedText text={children} {...EYEBROW_DECRYPT} />
    </p>
  )
}

function LiveBand({ data, error, fetchedAt, now }) {
  // The uptime column drifts up against the static copy as the band scrolls
  // past, so the big number feels like it's catching the eye rather than
  // sitting flat with the rest of the card.
  const { ref, transform } = useScrollParallax({ range: [40, -40] })
  const overall = data ? OVERALL[data.overall] || OVERALL.unknown : OVERALL.unknown
  const averageUptime = useMemo(() => {
    if (!data?.sites?.length) return null
    const total = data.sites.reduce((sum, site) => sum + (site.uptime_30d ?? 100), 0)
    return total / data.sites.length
  }, [data])
  const feedStale = error && data

  return (
    <motion.div
      ref={ref}
      {...fadeInUpMount}
      className="border-hair-paper bg-hair-paper grid gap-px overflow-hidden border lg:grid-cols-[1.6fr_1fr]"
    >
      <div className="flex flex-col gap-6 bg-paper p-8 sm:p-10">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="relative mt-2 flex h-2.5 w-2.5 flex-shrink-0">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${overall.ping}`}
            />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${overall.dot}`} />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              <DecryptedText key={overall.eyebrow} text={overall.eyebrow} {...EYEBROW_DECRYPT} />
            </p>
            <p className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.04] tracking-tightest text-ink-paper">
              {overall.title}
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper-soft">
              {overall.body}{' '}
              {fetchedAt && (
                <>
                  Last check{' '}
                  <span className="font-mono text-[14px] font-semibold text-ink-paper">
                    {formatClock(fetchedAt)}
                  </span>
                  , refreshed every minute around the clock.
                </>
              )}
            </p>
            <p
              className={`mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] ${
                feedStale ? 'text-amber-600' : 'text-paper-faint'
              }`}
              aria-live="polite"
            >
              {feedStale ? (
                <WifiOff className="h-3 w-3" strokeWidth={1.75} />
              ) : (
                <Radio className="h-3 w-3" strokeWidth={1.75} />
              )}
              {feedStale
                ? `Feed unreachable, showing data from ${relative(fetchedAt, now)}`
                : fetchedAt
                  ? `Live · updated ${relative(fetchedAt, now)}`
                  : error
                    ? 'Feed unreachable, retrying'
                    : 'Connecting'}
            </p>
          </div>
        </div>
      </div>

      <motion.div
        style={{ transform }}
        className="flex flex-col justify-center gap-3 bg-paper p-8 will-change-transform sm:p-10"
      >
        <p className="text-paper-faint font-mono text-[10px] uppercase tracking-[0.22em]">
          <DecryptedText text="// Uptime · 30 days" {...EYEBROW_DECRYPT} />
        </p>
        <p className="font-mono text-[clamp(2.4rem,5vw,3.4rem)] font-semibold leading-none text-ink-paper">
          {averageUptime === null ? (
            <span className="inline-block h-[0.9em] w-[4.5ch] animate-pulse rounded-sm bg-paper-soft/15" />
          ) : (
            <>
              <CountUp to={Math.floor(averageUptime)} duration={1.6} />.
              {Math.round((averageUptime % 1) * 100)
                .toString()
                .padStart(2, '0')}
              <span className="text-paper-faint">%</span>
            </>
          )}
        </p>
        <p className="text-paper-faint font-mono text-[10px] uppercase tracking-[0.22em]">
          across every site I watch
        </p>
      </motion.div>
    </motion.div>
  )
}

function SiteRow({ site }) {
  const cfg = SITE_STATE[site.status] || SITE_STATE.operational
  return (
    <div className="flex items-center gap-4 bg-paper px-5 py-4 sm:gap-5 sm:px-6">
      <span aria-hidden="true" className={`inline-flex h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink-paper">{site.name}</p>
        <p className="truncate font-mono text-[11px] text-paper-soft">{site.domain}</p>
      </div>
      <span className="text-paper-faint hidden font-mono text-[10px] uppercase tracking-[0.18em] sm:inline">
        {site.uptime_30d?.toFixed(2)}% · 30d
      </span>
      <span
        className={`flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] ${cfg.text}`}
        aria-label={`${site.name} is ${cfg.label.toLowerCase()}`}
      >
        {cfg.label}
      </span>
    </div>
  )
}

function SkeletonRows({ count }) {
  return (
    <div className="divide-hair-paper divide-y" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-paper px-5 py-4 sm:gap-5 sm:px-6">
          <span className="inline-flex h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-paper-soft/20" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-40 animate-pulse rounded-sm bg-paper-soft/15" />
            <span className="block h-2.5 w-28 animate-pulse rounded-sm bg-paper-soft/10" />
          </div>
          <span className="h-2.5 w-8 animate-pulse rounded-sm bg-paper-soft/15" />
        </div>
      ))}
    </div>
  )
}

function IncidentCard({ incident, now }) {
  const cfg = INCIDENT_STATE[incident.status] || INCIDENT_STATE.investigating
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="border-hair-paper relative overflow-hidden border bg-paper"
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${cfg.bar}`} />
      <div className="p-6 pl-7 sm:p-7 sm:pl-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-soft">
            {incident.site}
          </p>
          <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${cfg.tone}`}>
            {cfg.label}
          </p>
          <p className="text-paper-faint ml-auto font-mono text-[10px] uppercase tracking-[0.18em]">
            {incident.status === 'resolved' && incident.resolved_at
              ? `Resolved ${relative(new Date(incident.resolved_at), now)}`
              : `Opened ${relative(new Date(incident.opened_at), now)}`}
          </p>
        </div>
        <h3 className="mt-3 text-[18px] font-semibold tracking-tight text-ink-paper sm:text-[20px]">
          {incident.title}
        </h3>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-paper-soft">
          {incident.summary}
        </p>
        {incident.updates?.length > 1 && (
          <ol className="border-hair-paper mt-5 space-y-3 border-t pt-4">
            {incident.updates.map((update, i) => (
              <li key={`${update.at}-${i}`} className="flex gap-4 text-[13px]">
                <span className="text-paper-faint w-[7.5rem] flex-shrink-0 font-mono text-[10px] uppercase leading-5 tracking-[0.12em]">
                  {formatWhen(update.at)}
                </span>
                <span className="leading-5 text-paper-soft">{update.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </motion.article>
  )
}

function SectionHeading({ number, eyebrow, title, children }) {
  return (
    <motion.div {...fadeInUp} className="mb-10">
      <Eyebrow>{`// ${number} — ${eyebrow}`}</Eyebrow>
      <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink-paper">
        {title}
      </h2>
      {children && (
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-paper-soft">{children}</p>
      )}
    </motion.div>
  )
}

export default function Status() {
  const { data, error, fetchedAt, loading } = useStatusFeed()
  const now = useNow(10_000)

  const openIncidents = useMemo(
    () => (data?.incidents || []).filter(incident => incident.status !== 'resolved'),
    [data]
  )
  const resolvedIncidents = useMemo(
    () => (data?.incidents || []).filter(incident => incident.status === 'resolved').slice(0, 12),
    [data]
  )
  const windowStart = useMemo(() => {
    const start = new Date()
    start.setDate(start.getDate() - ((data?.window_days || 30) - 1))
    return formatDay(start)
  }, [data])
  const outageCount = data?.outages_30d ?? 0

  return (
    <div>
      <Seo
        title="System Status"
        description="Live status of every site TaylorURL hosts and maintains, with plain-English notes on anything being worked."
        path="/status"
      />
      <PageHero
        eyebrow="// 01 — Status"
        title="A live look at every site."
        description="Each site I host and maintain is checked every minute, around the clock. Green means up, amber means an issue is being worked, red means down. When something goes wrong, it shows here in plain English."
      />

      <section className="relative overflow-hidden bg-paper py-20 sm:py-28">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1080px] px-6 sm:px-10 lg:px-16">
          <LiveBand data={data} error={error} fetchedAt={fetchedAt} now={now} />

          <div className="mt-20">
            <SectionHeading number="02" eyebrow="Every site I watch" title="Site by site.">
              Each row is a real site, checked from outside every minute. The uptime figure covers
              the last 30 days.
            </SectionHeading>
            <SpotlightCard className="border-hair-paper border" spotlightColor="rgba(47,107,255,0.12)">
              {loading ? (
                <SkeletonRows count={8} />
              ) : data?.sites?.length ? (
                <div className="divide-hair-paper divide-y">
                  {data.sites.map(site => (
                    <SiteRow key={site.id} site={site} />
                  ))}
                </div>
              ) : (
                <div className="bg-paper px-6 py-10 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-soft">
                    The status feed is not answering
                  </p>
                  <p className="mt-3 text-[14px] text-paper-soft">
                    This page keeps trying on its own. If it stays blank, email me and I will check
                    by hand.
                  </p>
                </div>
              )}
            </SpotlightCard>
          </div>

          <div className="mt-20">
            <SectionHeading number="03" eyebrow="What's being worked" title="Open right now.">
              Anything a site reports gets looked at within minutes. Each card says what a visitor
              might have noticed and what is happening about it.
            </SectionHeading>
            {loading ? (
              <div className="border-hair-paper border">
                <SkeletonRows count={2} />
              </div>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {openIncidents.length ? (
                  <div className="grid gap-4">
                    {openIncidents.map(incident => (
                      <IncidentCard key={incident.id} incident={incident} now={now} />
                    ))}
                  </div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-hair-paper flex items-center gap-4 border bg-paper px-6 py-7"
                  >
                    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Check className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-[15px] font-medium text-ink-paper">Nothing open.</p>
                      <p className="mt-1 text-[13px] text-paper-soft">
                        If a site runs into trouble, it appears here within a minute.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </section>

      <section className="border-hair relative overflow-hidden border-t bg-bg py-20 text-ink sm:py-28">
        <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1080px] px-6 sm:px-10 lg:px-16">
          <motion.div {...fadeInUp} className="grid items-start gap-8 sm:grid-cols-[200px_1fr] sm:gap-14">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Last 30 days</p>
              <p className="mt-4 font-mono text-[clamp(2.6rem,4.6vw,3.6rem)] font-semibold tabular-nums leading-none text-ink">
                {data ? outageCount : '–'}
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                {outageCount === 1 ? 'outage' : 'outages'} since {windowStart}
              </p>
            </div>
            <div>
              <h3 className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-tightest text-ink">
                {resolvedIncidents.length ? 'Fixed recently.' : `Clean stretch since ${windowStart}.`}
              </h3>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                {resolvedIncidents.length
                  ? 'Problems that were found, fixed, and checked again on the live site. Most never reach a visitor.'
                  : 'Nothing has needed fixing in this window. When something does, it is listed here once it is checked and closed.'}
              </p>
              {resolvedIncidents.length > 0 && (
                <ol className="border-hair mt-8 divide-y divide-[color:var(--hair)] border-t">
                  {resolvedIncidents.map(incident => (
                    <li key={incident.id} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-4">
                      <span className="w-[5.5rem] flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                        {formatDay(incident.resolved_at || incident.opened_at)}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                        {incident.site}
                      </span>
                      <span className="min-w-0 flex-1 text-[14px] text-ink-soft">
                        {incident.summary}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-hair relative overflow-hidden border-t bg-bg py-24 text-ink sm:py-32">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="bg-accent/12 pointer-events-none absolute right-0 top-0 h-72 w-72 -translate-y-1/3 translate-x-1/4 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <motion.div {...fadeInUp} className="relative mx-auto w-full max-w-[920px] px-6 text-center sm:px-10">
          <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
            <span className="h-px w-8 bg-accent" />
            <DecryptedText text="// Spot something off?" {...EYEBROW_DECRYPT} />
            <span className="h-px w-8 bg-accent" />
          </p>
          <h2 className="text-[clamp(2rem,4.6vw,3.2rem)] font-semibold leading-[1.04] tracking-tightest text-ink">
            Tell me — I&apos;ll <AccentGradient>look into it</AccentGradient>.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            If something on your site is acting up and it is not listed above, send a quick message.
            I will dig in and get back to you.
          </p>
          <div className="mt-10 flex justify-center">
            <Magnet padding={70} magnetStrength={4}>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
              >
                Get in Touch
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </Magnet>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
