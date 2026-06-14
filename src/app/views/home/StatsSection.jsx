import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useCountUp from '@hooks/useCountUp'
import {
  CHART_AXIS_STYLE,
  CHART_TOOLTIP_STYLE,
  CUSTOMER_DISCOVERY_DATA,
  LOCAL_SEARCH_STATS,
} from '@data/home'
import { SECTION_H2 } from '@constants/ui'

export default function StatsSection() {
  const { count: localSearchPercent, ref: statRef } = useCountUp(46, 2500)

  return (
    <section className="border-t border-gray-200 bg-gray-50 py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <h2 className={`mb-4 ${SECTION_H2}`}>
              Can People Actually <span className="logo-wave-dark">Find You?</span>
            </h2>
            <p className="mb-8 text-base text-gray-600 sm:text-lg">
              Almost every customer starts with a Google search. No website means they&apos;re
              calling the other guy.
            </p>
            <div className="rounded-2xl border border-gray-200 bg-surface-overlay p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                How Customers Find Local Businesses
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={CUSTOMER_DISCOVERY_DATA}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" domain={[0, 50]} tick={CHART_AXIS_STYLE} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#374151', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={value => [`${value}%`, 'Percentage']}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <div ref={statRef} className="mb-8 text-center">
              <div className="text-5xl font-bold text-gray-900 sm:text-7xl">
                {localSearchPercent}%
              </div>
              <div className="mt-2 text-base text-gray-600 sm:text-lg">
                of all searches have local intent
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:gap-6">
              {LOCAL_SEARCH_STATS.map(stat => (
                <div key={stat.value}>
                  <div className="text-xl font-bold text-gray-900 sm:text-3xl">{stat.value}</div>
                  <div className="text-xs text-gray-500 sm:text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
