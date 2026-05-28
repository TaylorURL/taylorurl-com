import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { supabase } from '@app/lib/supabase'
import {
  aggregateWebsiteStats,
  StatCard,
  WebsiteRow,
  EmptyState,
  DashboardSkeleton,
} from '@components/DashboardWidgets'

const INITIAL_STATS = { totalOnlineNow: 0, totalPageViews: 0, avgUptime: 0, totalSites: 0 }

/** Return a new site object with `visitors_now` overridden by the live count. */
function applyLiveVisitorCount(site, liveCount) {
  const existingStats = site.website_stats?.[0]
  const nextStats = { ...(existingStats ?? {}), visitors_now: liveCount }
  return { ...site, website_stats: [nextStats] }
}

function SortButton({ label, active, dir, onClick }) {
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : null
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
        active ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
      {Icon && <Icon className="h-3 w-3" />}
    </button>
  )
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [websites, setWebsites] = useState([])
  const [stats, setStats] = useState(INITIAL_STATS)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Client'

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  useEffect(() => {
    if (user?.id) fetchWebsites()
  }, [user?.id])

  // Poll live visitor counts every 30s so "Online Now" stays fresh between
  // full refreshes (the hourly aggregate-stats cron only writes visitors_now once per hour).
  useEffect(() => {
    if (!user?.id || loading) return
    const interval = setInterval(() => refreshLiveVisitors(), 30_000)
    return () => clearInterval(interval)
  }, [user?.id, loading])

  /** Fetch live visitor counts from active_visitors and overlay onto the hourly snapshot. */
  async function refreshLiveVisitors() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analytics-service/live-visitors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      )
      if (!response.ok) return

      const { counts } = await response.json()
      setWebsites(prev => {
        const merged = prev.map(site => applyLiveVisitorCount(site, counts[site.id] ?? 0))
        setStats(aggregateWebsiteStats(merged))
        return merged
      })
    } catch {
      // Best-effort — leave snapshot in place on failure
    }
  }

  async function fetchWebsites({ silent = false } = {}) {
    if (!user?.id) return

    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const { data, error } = await supabase
        .from('websites')
        .select('*, website_stats(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        toast('Failed to load websites', 'error')
        return
      }

      const siteData = data || []
      setWebsites(siteData)
      setStats(aggregateWebsiteStats(siteData))

      // Overlay live visitor counts immediately so "Online Now" reflects reality,
      // not the hour-old snapshot.
      refreshLiveVisitors()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const sortedWebsites = useMemo(() => {
    const getValue = site => {
      const s = site.website_stats?.[0]
      switch (sortKey) {
        case 'name':
          return (site.name || '').toLowerCase()
        case 'status':
          return site.status || ''
        case 'online':
          return s?.visitors_now ?? -1
        case 'views':
          return s?.page_views_30d ?? -1
        case 'uptime':
          return s?.uptime_pct ?? -1
        default:
          return ''
      }
    }
    return [...websites].sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [websites, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <>
      <Seo
        title="Dashboard"
        description="Manage your websites and view analytics."
        path="/dashboard"
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">{todayFormatted}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {getTimeOfDayGreeting()}, {displayName}
              </h1>
            </div>
            <button
              onClick={() => fetchWebsites({ silent: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <section className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 xl:grid-cols-4">
            <StatCard
              label="Online Now"
              value={stats.totalOnlineNow.toLocaleString()}
              period="All sites"
            />
            <StatCard
              label="Total Views"
              value={stats.totalPageViews.toLocaleString()}
              period="All time"
            />
            <StatCard
              label="Avg Uptime"
              value={stats.avgUptime ? `${stats.avgUptime}%` : '--'}
              period="All sites"
            />
            <StatCard label="Sites" value={stats.totalSites} period="Portfolio" />
          </section>

          {/* Websites */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">Websites</h2>
              <span className="text-sm text-gray-400">
                {websites.length} site{websites.length !== 1 ? 's' : ''}
              </span>
            </div>

            {websites.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {/* Sort header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-2">
                  <div className="flex gap-2">
                    {[
                      { key: 'name', label: 'Name' },
                      { key: 'status', label: 'Status' },
                    ].map(({ key, label }) => (
                      <SortButton
                        key={key}
                        label={label}
                        active={sortKey === key}
                        dir={sortDir}
                        onClick={() => handleSort(key)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {[
                      { key: 'online', label: 'Online' },
                      { key: 'views', label: 'Views' },
                      { key: 'uptime', label: 'Uptime' },
                    ].map(({ key, label }) => (
                      <SortButton
                        key={key}
                        label={label}
                        active={sortKey === key}
                        dir={sortDir}
                        onClick={() => handleSort(key)}
                      />
                    ))}
                  </div>
                </div>
                {sortedWebsites.map((site, index) => (
                  <WebsiteRow
                    key={site.id}
                    site={site}
                    isLast={index === sortedWebsites.length - 1}
                  />
                ))}
              </div>
            )}
          </section>
        </motion.div>
      )}
    </>
  )
}
