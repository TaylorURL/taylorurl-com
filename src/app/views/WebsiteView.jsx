import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Seo from '@components/Seo'
import { ErrorCard, deriveErrorStatus } from '@components/ErrorCard'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { supabase } from '@app/lib/supabase'

const STATUS_DOT = {
  active: 'bg-emerald-500',
  maintenance: 'bg-amber-500',
  development: 'bg-blue-500',
  down: 'bg-red-500',
  paused: 'bg-gray-400',
}

function StatCell({ label, value }) {
  return (
    <div className="bg-white px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
    </div>
  )
}

function SectionHeading({ children }) {
  return <h2 className="mb-4 text-[15px] font-semibold text-gray-900">{children}</h2>
}

function ChartCard({ children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5">{children}</div>
  )
}

/** Bucket page_views rows into daily counts for the last 30 days. */
function buildDailyViews(pageViews) {
  const map = {}
  const now = Date.now()

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    map[key] = { date: key, views: 0, visitors: new Set() }
  }

  for (const row of pageViews) {
    const d = new Date(row.created_at)
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (map[key]) {
      map[key].views++
      map[key].visitors.add(row.visitor_id)
    }
  }

  return Object.values(map).map(({ date, views, visitors }) => ({
    date,
    views,
    visitors: visitors.size,
  }))
}

/** Bucket uptime_checks into hourly avg response time for the last 48 hours. */
function buildUptimeHistory(uptimeChecks) {
  const map = {}
  const now = Date.now()

  for (let i = 47; i >= 0; i--) {
    const d = new Date(now - i * 3600000)
    const key = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    map[`${d.toLocaleDateString()}-${key}`] = { label: key, responseMs: [], isUp: [] }
  }

  for (const row of uptimeChecks) {
    const d = new Date(row.created_at)
    const key = `${d.toLocaleDateString()}-${d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}`
    if (map[key]) {
      if (row.response_time_ms) map[key].responseMs.push(row.response_time_ms)
      map[key].isUp.push(row.is_up)
    }
  }

  return Object.values(map).map(({ label, responseMs, isUp }) => ({
    label,
    responseMs: responseMs.length
      ? Math.round(responseMs.reduce((a, b) => a + b, 0) / responseMs.length)
      : null,
    upPct: isUp.length ? Math.round((isUp.filter(Boolean).length / isUp.length) * 100) : null,
  }))
}

/** Top pages by view count. */
function buildTopPages(pageViews) {
  const map = {}
  for (const row of pageViews) {
    map[row.page_url] = (map[row.page_url] || 0) + 1
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([url, count]) => ({ url, count }))
}

export default function WebsiteView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [site, setSite] = useState(null)
  const [pageViews, setPageViews] = useState([])
  const [uptimeChecks, setUptimeChecks] = useState([])
  const [errors, setErrors] = useState([])
  const [errorTab, setErrorTab] = useState('open')
  const [loading, setLoading] = useState(true)

  const ERROR_TABS = ['open', 'closed', 'fixed', 'skipped', 'all']

  const tabCounts = useMemo(
    () =>
      ERROR_TABS.reduce((acc, tab) => {
        acc[tab] =
          tab === 'all' ? errors.length : errors.filter(e => deriveErrorStatus(e) === tab).length
        return acc
      }, {}),
    [errors]
  )

  const visibleErrors = useMemo(
    () => (errorTab === 'all' ? errors : errors.filter(e => deriveErrorStatus(e) === errorTab)),
    [errors, errorTab]
  )

  const dailyViews = useMemo(() => buildDailyViews(pageViews), [pageViews])
  const uptimeHistory = useMemo(() => buildUptimeHistory(uptimeChecks), [uptimeChecks])
  const topPages = useMemo(() => buildTopPages(pageViews), [pageViews])
  const uniqueVisitors = useMemo(() => new Set(pageViews.map(r => r.visitor_id)).size, [pageViews])

  useEffect(() => {
    if (user?.id && id) fetchData()
  }, [user?.id, id])

  async function fetchData() {
    setLoading(true)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const [{ data: siteData, error }, { data: views }, { data: uptime }, { data: siteErrors }] =
      await Promise.all([
        supabase
          .from('websites')
          .select('*, website_stats(*)')
          .eq('id', id)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('page_views')
          .select('visitor_id, page_url, created_at')
          .eq('website_id', id)
          .gte('created_at', thirtyDaysAgo),
        supabase
          .from('uptime_checks')
          .select('is_up, response_time_ms, created_at')
          .eq('website_id', id)
          .gte('created_at', fortyEightHoursAgo)
          .order('created_at', { ascending: true }),
        supabase.from('client_errors').select('*').order('created_at', { ascending: false }),
      ])

    if (error || !siteData) {
      toast('Site not found', 'error')
      navigate('/dashboard')
      return
    }

    setSite(siteData)
    setPageViews(views || [])
    setUptimeChecks(uptime || [])
    setErrors((siteErrors || []).filter(e => e.project === siteData.domain))
    setLoading(false)
  }

  const stats = site?.website_stats?.[0]
  const uptimePct = stats?.uptime_pct != null ? `${stats.uptime_pct}%` : '--'
  const statusDot = STATUS_DOT[site?.status] || STATUS_DOT.active
  const maxViews = Math.max(...topPages.map(p => p.count), 1)

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-8 h-8 w-48 rounded bg-gray-200" />
        <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white px-6 py-5">
              <div className="h-2.5 w-16 rounded bg-gray-200" />
              <div className="mt-3 h-6 w-14 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <Seo
        title={site.name}
        description={`Analytics for ${site.domain}`}
        path={`/dashboard/site/${id}`}
      />

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Overview
            </button>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500">
                {(site.domain || site.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{site.name}</p>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                </div>
                <a
                  href={`https://${site.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600"
                >
                  {site.domain}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <section className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 xl:grid-cols-4">
          <StatCell label="Online Now" value={(stats?.visitors_now || 0).toLocaleString()} />
          <StatCell label="Unique Visitors" value={uniqueVisitors.toLocaleString()} />
          <StatCell label="Total Views" value={pageViews.length.toLocaleString()} />
          <StatCell label="Avg Uptime" value={uptimePct} />
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily page views */}
          <ChartCard>
            <SectionHeading>Page Views — Last 30 Days</SectionHeading>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyViews} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#viewsGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Daily unique visitors */}
          <ChartCard>
            <SectionHeading>Unique Visitors — Last 30 Days</SectionHeading>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyViews} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#visitorsGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Response time */}
          <ChartCard>
            <SectionHeading>Response Time — Last 48 Hours</SectionHeading>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={uptimeHistory} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="responseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  interval={7}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  unit="ms"
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={v =>
                    v != null ? [`${v}ms`, 'Response Time'] : ['--', 'Response Time']
                  }
                />
                <Area
                  type="monotone"
                  dataKey="responseMs"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#responseGrad)"
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top pages */}
          <ChartCard>
            <SectionHeading>Top Pages — Last 30 Days</SectionHeading>
            {topPages.length === 0 ? (
              <p className="mt-6 text-center text-sm text-gray-400">No page view data yet</p>
            ) : (
              <div className="space-y-2.5">
                {topPages.map(({ url, count }) => (
                  <div key={url} className="flex items-center gap-3">
                    <p className="w-32 shrink-0 truncate text-xs text-gray-500 sm:w-48">
                      {url || '/'}
                    </p>
                    <div
                      className="relative flex-1 overflow-hidden rounded-full bg-gray-100"
                      style={{ height: 6 }}
                    >
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${(count / maxViews) * 100}%` }}
                      />
                    </div>
                    <p className="w-8 text-right text-xs font-semibold tabular-nums text-gray-700">
                      {count}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>

        {/* Errors */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-gray-900">Errors</h2>
            <span className="text-sm text-gray-400">{errors.length} total</span>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {ERROR_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setErrorTab(tab)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  errorTab === tab
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                {tab}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    errorTab === tab ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>

          {visibleErrors.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
              <p className="text-sm text-gray-400">
                No {errorTab === 'all' ? '' : errorTab} errors for this site
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleErrors.map(error => (
                <ErrorCard key={error.id} error={error} hideProject />
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </>
  )
}
