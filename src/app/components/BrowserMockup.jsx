import { motion } from 'framer-motion'

const BAR_VARIANTS = {
  initial: { scaleX: 0 },
  animate: i => ({
    scaleX: 1,
    transition: { duration: 0.6, delay: 0.8 + i * 0.15, ease: 'easeOut' },
  }),
}

const PULSE_TRANSITION = {
  repeat: Infinity,
  repeatType: 'reverse',
  duration: 2,
  ease: 'easeInOut',
}

export default function BrowserMockup({ url = 'yourbusiness.com', variant = 'default', className = '' }) {
  return (
    <div className={`w-full rounded-xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/10 ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
        <motion.div
          className="h-2.5 w-2.5 rounded-full bg-red-400"
          whileHover={{ scale: 1.4 }}
        />
        <motion.div
          className="h-2.5 w-2.5 rounded-full bg-yellow-400"
          whileHover={{ scale: 1.4 }}
        />
        <motion.div
          className="h-2.5 w-2.5 rounded-full bg-green-400"
          whileHover={{ scale: 1.4 }}
        />
        <div className="ml-3 flex-1 rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-400">
          {url}
        </div>
      </div>
      <div className="p-5">
        {variant === 'default' && <DefaultContent />}
        {variant === 'analytics' && <AnalyticsContent />}
        {variant === 'mobile' && <MobileContent />}
        {variant === 'code' && <CodeContent />}
      </div>
    </div>
  )
}

function DefaultContent() {
  return (
    <div className="space-y-3">
      <motion.div
        className="h-5 w-3/4 origin-left rounded bg-gray-200"
        {...BAR_VARIANTS}
        custom={0}
      />
      <motion.div
        className="h-3 w-full origin-left rounded bg-gray-100"
        {...BAR_VARIANTS}
        custom={1}
      />
      <motion.div
        className="h-3 w-5/6 origin-left rounded bg-gray-100"
        {...BAR_VARIANTS}
        custom={2}
      />
      <motion.div
        className="mt-4 h-32 rounded-lg bg-gradient-to-br from-blue-50 to-gray-50"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.3 }}
      />
      <motion.div
        className="flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.6 }}
      >
        <motion.div
          className="h-8 w-24 rounded-md bg-blue-500"
          animate={{ opacity: [0.7, 1] }}
          transition={PULSE_TRANSITION}
        />
        <div className="h-8 w-20 rounded-md bg-gray-100" />
      </motion.div>
    </div>
  )
}

function AnalyticsContent() {
  const bars = [65, 40, 80, 55, 90, 70, 85]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-gray-200" />
        <motion.div
          className="h-5 w-16 rounded bg-green-100 text-center text-[10px] font-bold leading-5 text-green-600"
          animate={{ opacity: [0.6, 1] }}
          transition={PULSE_TRANSITION}
        >
          +127%
        </motion.div>
      </div>
      <div className="flex items-end gap-1.5 pt-2" style={{ height: 100 }}>
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t bg-blue-500"
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.6, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
    </div>
  )
}

function MobileContent() {
  return (
    <div className="flex justify-center">
      <div className="w-[140px] rounded-2xl border-2 border-gray-200 bg-white p-2">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-200" />
        <motion.div
          className="mb-2 h-16 rounded-lg bg-gradient-to-b from-blue-50 to-blue-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        />
        <div className="space-y-1.5">
          <motion.div className="h-2 w-full origin-left rounded bg-gray-100" {...BAR_VARIANTS} custom={0} />
          <motion.div className="h-2 w-4/5 origin-left rounded bg-gray-100" {...BAR_VARIANTS} custom={1} />
          <motion.div className="h-2 w-3/5 origin-left rounded bg-gray-100" {...BAR_VARIANTS} custom={2} />
        </div>
        <motion.div
          className="mt-3 h-5 rounded bg-blue-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.7, 1] }}
          transition={{ ...PULSE_TRANSITION, delay: 1.2 }}
        />
      </div>
    </div>
  )
}

function CodeContent() {
  const lines = [
    { width: 'w-3/4', color: 'bg-blue-200' },
    { width: 'w-1/2', color: 'bg-purple-200' },
    { width: 'w-5/6', color: 'bg-green-200' },
    { width: 'w-2/3', color: 'bg-blue-200' },
    { width: 'w-3/5', color: 'bg-yellow-200' },
    { width: 'w-4/5', color: 'bg-purple-200' },
  ]

  return (
    <div className="space-y-2 rounded-lg bg-gray-900 p-4">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 text-right text-[10px] text-gray-600">{i + 1}</span>
          <motion.div
            className={`h-2.5 origin-left rounded ${line.width} ${line.color} opacity-60`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 0.6 }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.12 }}
          />
        </div>
      ))}
      <motion.div
        className="mt-2 h-0.5 w-2 bg-gray-400"
        animate={{ opacity: [1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
    </div>
  )
}
