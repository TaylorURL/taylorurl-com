import { m } from 'framer-motion'
import { EASE } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'

/**
 * The schematic of a page, drawn as a browser window.
 *
 * It stands for the work a service line does rather than for any one site, so
 * it is drawn in the site's own rules and accent instead of holding a capture.
 * Each variant is the shape that line's work takes on a page.
 *
 * The parts arrive in the order a page assembles and then stop. A reader
 * scrolling a service row meets the window finished; nothing in it keeps
 * moving afterwards, because a schematic that never settles reads as a thing
 * still loading.
 */

// One step between parts and one length for every part: no piece of the
// assembly runs longer than anything else on the site does, and the window is
// finished well inside the time a reader takes to reach it.
const STEP = 0.06
const REVEAL = { duration: 0.4, ease: EASE }

const BAR_VARIANTS = {
  initial: { scaleX: 0 },
  animate: i => ({
    scaleX: 1,
    transition: { ...REVEAL, delay: 0.1 + i * STEP },
  }),
}

// What a part waits before it draws, given its place in the assembly.
const at = order => ({ ...REVEAL, delay: 0.1 + order * STEP })

export default function BrowserMockup({
  url = 'yourbusiness.com',
  variant = 'default',
  className = '',
}) {
  return (
    <div
      {...GROUNDS.dark.attrs}
      className={`border-hair w-full overflow-hidden rounded-[var(--r-card)] border bg-bg text-ink shadow-[var(--lift)] ${className}`}
    >
      <div className="border-hair flex items-center gap-2 border-b bg-bg px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-ink-faint" />
        <span className="h-2 w-2 rounded-full bg-ink-faint" />
        <span className="h-2 w-2 rounded-full bg-ink-faint" />
        <div className="border-hair bg-surface-1 ml-3 flex-1 rounded-[var(--r-control)] border px-3 py-1 font-mono text-[11px] tracking-[0.01em] text-ink-faint">
          {url}
        </div>
        <span className="section-label-sm text-ink-faint">v1</span>
      </div>
      <div className="p-5">
        {variant === 'default' && <DefaultContent />}
        {variant === 'analytics' && <AnalyticsContent />}
        {variant === 'code' && <CodeContent />}
        {variant === 'dashboard' && <DashboardContent />}
      </div>
    </div>
  )
}

function DefaultContent() {
  return (
    <div className="space-y-3">
      <p className="section-label-sm text-accent">Hero</p>
      <m.div
        className="h-5 w-3/4 origin-left rounded-[var(--r-tiny)] bg-ink/20"
        {...BAR_VARIANTS}
        custom={0}
      />
      <m.div
        className="h-3 w-full origin-left rounded-[var(--r-tiny)] bg-ink/10"
        {...BAR_VARIANTS}
        custom={1}
      />
      <m.div
        className="h-3 w-5/6 origin-left rounded-[var(--r-tiny)] bg-ink/10"
        {...BAR_VARIANTS}
        custom={2}
      />
      <m.div
        className="border-hair mt-4 h-28 rounded-[var(--r-card)] border bg-accent/10"
        initial={{ opacity: 0, transform: 'scale(0.96)' }}
        animate={{ opacity: 1, transform: 'scale(1)' }}
        transition={at(3)}
      />
      <m.div
        className="flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={at(4)}
      >
        <div className="h-8 w-28 rounded-[var(--r-control)] bg-accent" />
        <div className="border-hair-strong h-8 w-20 rounded-[var(--r-control)] border" />
      </m.div>
    </div>
  )
}

function AnalyticsContent() {
  const bars = [65, 40, 80, 55, 90, 70, 85]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label-sm text-ink-faint">Traffic, Last 7 Days</p>
        <m.div
          className="rounded-[var(--r-tiny)] border border-accent/40 px-2 py-0.5 text-[11px] font-semibold text-accent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={at(0)}
        >
          Your Data
        </m.div>
      </div>
      <div className="flex items-end gap-1.5 pt-2" style={{ height: 100 }}>
        {bars.map((h, i) => (
          <m.div
            key={i}
            className="flex-1 rounded-[var(--r-tiny)] bg-accent"
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={at(i)}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-ink-faint">
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
        <span>Su</span>
      </div>
    </div>
  )
}

function CodeContent() {
  const lines = [
    { width: 'w-3/4' },
    { width: 'w-1/2' },
    { width: 'w-5/6' },
    { width: 'w-2/3' },
    { width: 'w-3/5' },
    { width: 'w-4/5' },
  ]

  return (
    <div className="border-hair space-y-2 rounded-[var(--r-card)] border bg-bg p-4">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-4 text-right font-mono text-[10px] text-ink-faint">{i + 1}</span>
          <m.div
            className={`h-2 origin-left rounded-[var(--r-tiny)] ${line.width} ${i % 2 === 0 ? 'bg-ink/20' : 'bg-accent/60'}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={at(i)}
          />
        </div>
      ))}
      {/* The caret the last line was typed against, which lands with it. */}
      <m.div
        className="mt-2 h-0.5 w-2 bg-accent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={at(lines.length)}
      />
    </div>
  )
}

function DashboardContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label-sm text-ink-faint">Monitor</p>
        <div className="flex gap-1.5">
          <div className="border-hair rounded-[var(--r-tiny)] border px-2 py-0.5 text-[11px] text-ink-faint">
            Today
          </div>
          <div className="rounded-[var(--r-tiny)] border border-accent/50 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
            Week
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Visitors', value: '—' },
          { label: 'Leads', value: '—' },
          { label: 'Conversion', value: '—' },
        ].map((stat, i) => (
          <m.div
            key={stat.label}
            className="border-hair rounded-[var(--r-control)] border p-2 text-center"
            initial={{ opacity: 0, transform: 'translateY(6px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            transition={at(i)}
          >
            <div className="font-mono text-[14px] font-semibold text-ink">{stat.value}</div>
            <div className="text-[10px] text-ink-faint">{stat.label}</div>
          </m.div>
        ))}
      </div>
      <m.div
        className="border-hair h-16 rounded-[var(--r-card)] border bg-gradient-to-r from-accent/10 via-accent/5 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={at(3)}
      />
      <div className="flex gap-2">
        <m.div
          className="h-1.5 flex-1 rounded-[var(--r-tiny)] bg-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={at(4)}
          style={{ originX: 0 }}
        />
        <m.div
          className="h-1.5 w-1/4 rounded-[var(--r-tiny)] bg-ink/30"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={at(5)}
          style={{ originX: 0 }}
        />
      </div>
    </div>
  )
}
