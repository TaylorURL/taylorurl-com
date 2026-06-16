import { motion } from 'framer-motion'
import { ArrowRight, Monitor, Smartphone, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fadeInUp } from '@constants/animations'
import { REVENUE_GROWTH_DATA } from '@data/home'
import { BTN_PRIMARY, SECTION_H2_DARK } from '@constants/ui'

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#e5e7eb',
}

const FACTS = [
  {
    icon: TrendingUp,
    stat: '+110%',
    label: 'more revenue',
    detail:
      'Businesses with a real online presence consistently outperform those without one over a 12-month window.',
  },
  {
    icon: Smartphone,
    stat: '70%',
    label: 'mobile searches',
    detail:
      'Most local searches happen on a phone. If the site is not fast and usable on mobile, those visitors leave before the page loads.',
  },
  {
    icon: Monitor,
    stat: '<2s',
    label: 'load time',
    detail:
      'Every site I build loads in under two seconds. Faster pages convert more visitors and rank higher in search.',
  },
]

export default function DataSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-gray-950 py-14 sm:py-24">
      <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Top: message + chart */}
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <motion.div {...fadeInUp}>
            <h2 className={`mb-5 ${SECTION_H2_DARK}`}>
              A Real Online Presence Isn&apos;t a Nice-to-Have.{' '}
              <span className="logo-wave">It&apos;s the Difference.</span>
            </h2>
            <p className="mb-6 text-base leading-relaxed text-gray-400 sm:text-lg">
              Local businesses with a real website grow faster, get found more, and close more
              customers. The ones without stay stuck on word of mouth and hoping the phone rings.
            </p>
            <p className="mb-8 text-gray-500">
              This isn&apos;t theory — it&apos;s what happens every time. A professional site puts
              your business where your neighbors are already looking.
            </p>
            <Link to="/contact" className={`group ${BTN_PRIMARY}`}>
              Get in Touch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          <motion.div {...fadeInUp} transition={{ delay: 0.1 }}>
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/80 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
                <span className="text-xs font-medium text-gray-400">12-Month Revenue Growth</span>
                <div className="flex gap-4 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-4 rounded-full bg-blue-500" />
                    <span className="text-gray-500">With Website</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-0.5 w-4 border-t border-dashed border-gray-600" />
                    <span className="text-gray-500">Without</span>
                  </div>
                </div>
              </div>
              <div className="px-3 pb-2 pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={REVENUE_GROWTH_DATA}
                    margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
                  >
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#4b5563', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[90, 220]}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${value}%`,
                        name === 'withSite' ? 'With Website' : 'Without Website',
                      ]}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="withSite"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
                      name="withSite"
                    />
                    <Line
                      type="monotone"
                      dataKey="withoutSite"
                      stroke="#4b5563"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={{ fill: '#4b5563', strokeWidth: 0, r: 2 }}
                      name="withoutSite"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom: three fact cards */}
        <motion.div
          {...fadeInUp}
          transition={{ delay: 0.2 }}
          className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3"
        >
          {FACTS.map(fact => {
            const Icon = fact.icon
            return (
              <div
                key={fact.label}
                className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-2xl font-bold text-white">{fact.stat}</span>
                  <span className="text-sm text-gray-500">{fact.label}</span>
                </div>
                <p className="text-sm leading-relaxed text-gray-400">{fact.detail}</p>
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
