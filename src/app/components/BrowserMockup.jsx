import { motion } from 'framer-motion'

const BAR_VARIANTS = {
  initial: { scaleX: 0 },
  animate: i => ({
    scaleX: 1,
    transition: { duration: 0.5, delay: 0.5 + i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}

const PULSE_TRANSITION = {
  repeat: Infinity,
  repeatType: 'reverse',
  duration: 2.2,
  ease: 'easeInOut',
}

export default function BrowserMockup({
  url = 'yourbusiness.com',
  variant = 'default',
  className = '',
}) {
  return (
    <div
      className={`border-hair w-full overflow-hidden rounded-sm border bg-bg text-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] ${className}`}
    >
      <div className="border-hair flex items-center gap-2 border-b bg-bg px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-ink-faint" />
        <span className="h-2 w-2 rounded-full bg-ink-faint" />
        <span className="h-2 w-2 rounded-full bg-ink-faint" />
        <div className="border-hair bg-surface-1 ml-3 flex-1 rounded-sm border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          {url}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">v1</span>
      </div>
      <div className="p-5">
        {variant === 'default' && <DefaultContent />}
        {variant === 'analytics' && <AnalyticsContent />}
        {variant === 'mobile' && <MobileContent />}
        {variant === 'code' && <CodeContent />}
        {variant === 'dashboard' && <DashboardContent />}
      </div>
    </div>
  )
}

function DefaultContent() {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">// hero</p>
      <motion.div
        className="bg-ink/20 h-5 w-3/4 origin-left rounded-sm"
        {...BAR_VARIANTS}
        custom={0}
      />
      <motion.div
        className="bg-ink/10 h-3 w-full origin-left rounded-sm"
        {...BAR_VARIANTS}
        custom={1}
      />
      <motion.div
        className="bg-ink/10 h-3 w-5/6 origin-left rounded-sm"
        {...BAR_VARIANTS}
        custom={2}
      />
      <motion.div
        className="border-hair bg-accent/10 mt-4 h-28 rounded-sm border"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.3 }}
      >
        <motion.div
          className="h-8 w-28 rounded-sm bg-accent"
          animate={{ opacity: [0.75, 1] }}
          transition={PULSE_TRANSITION}
        />
        <div className="border-hair-strong h-8 w-20 rounded-sm border" />
      </motion.div>
    </div>
  )
}

function AnalyticsContent() {
  const bars = [65, 40, 80, 55, 90, 70, 85]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          // traffic — last 7d
        </p>
        <motion.div
          className="border-accent/40 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent"
          animate={{ opacity: [0.7, 1] }}
          transition={PULSE_TRANSITION}
        >
          +127%
        </motion.div>
      </div>
      <div className="flex items-end gap-1.5 pt-2" style={{ height: 100 }}>
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-sm bg-accent"
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
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

function MobileContent() {
  return (
    <div className="flex justify-center">
      <div className="border-hair w-[140px] rounded-sm border bg-bg p-2">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink-faint" />
        <motion.div
          className="bg-accent/15 mb-2 h-16 rounded-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        />
        <div className="space-y-1.5">
          <motion.div
            className="bg-ink/10 h-2 w-full origin-left rounded-sm"
            {...BAR_VARIANTS}
            custom={0}
          />
          <motion.div
            className="bg-ink/10 h-2 w-4/5 origin-left rounded-sm"
            {...BAR_VARIANTS}
            custom={1}
          />
          <motion.div
            className="bg-ink/10 h-2 w-3/5 origin-left rounded-sm"
            {...BAR_VARIANTS}
            custom={2}
          />
        </div>
        <motion.div
          className="mt-3 h-5 rounded-sm bg-accent"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.7, 1] }}
          transition={{ ...PULSE_TRANSITION, delay: 1 }}
        />
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
    <div className="border-hair space-y-2 rounded-sm border bg-bg p-4">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-4 text-right font-mono text-[10px] text-ink-faint">{i + 1}</span>
          <motion.div
            className={`h-2 origin-left rounded-sm ${line.width} ${i % 2 === 0 ? 'bg-ink/20' : 'bg-accent/60'}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      ))}
      <motion.div
        className="mt-2 h-0.5 w-2 bg-accent"
        animate={{ opacity: [1, 0] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
      />
    </div>
  )
}

function DashboardContent() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          // monitor
        </p>
        <div className="flex gap-1.5">
          <div className="border-hair rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            Today
          </div>
          <div className="border-accent/50 bg-accent/10 rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
            Week
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Visitors', value: '1,247' },
          { label: 'Leads', value: '38' },
          { label: 'Convert.', value: '3.0%' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="border-hair rounded-sm border p-2 text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
          >
            <div className="font-mono text-[14px] font-semibold text-ink">{stat.value}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="border-hair from-accent/10 via-accent/5 h-16 rounded-sm border bg-gradient-to-r to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
      />
      <div className="flex gap-2">
        <motion.div
          className="h-1.5 flex-1 rounded-sm bg-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 1.15 }}
          style={{ originX: 0 }}
        />
        <motion.div
          className="bg-ink/30 h-1.5 w-1/4 rounded-sm"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 1.25 }}
          style={{ originX: 0 }}
        />
      </div>
    </div>
  )
}
