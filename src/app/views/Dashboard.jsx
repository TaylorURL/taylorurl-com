import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
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
  const [errorCountsByDomain, setErrorCountsByDomain] = useState({})
  const [loading, setLoading] = useState(true)

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

  async function fetchWebsites() {
    if (!user?.id) return

    setLoading(true)
    try {
      const [{ data, error }, { data: openErrors }] = await Promise.all([
        supabase
          .from('websites')
          .select('*, website_stats(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('client_errors').select('project').eq('fixed', false).eq('skipped', false),
      ])

      if (error) {
        toast('Failed to load websites', 'error')
        return
      }

      const siteData = data || []
      setWebsites(siteData)
      setStats(aggregateWebsiteStats(siteData))

      const counts = {}
      for (const row of openErrors || []) {
        counts[row.project] = (counts[row.project] || 0) + 1
      }
      setErrorCountsByDomain(counts)
    } finally {
      setLoading(false)
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
              onClick={fetchWebsites}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
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
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-gray-900">Websites</h2>
              <span className="text-sm text-gray-400">
                {websites.length} site{websites.length !== 1 ? 's' : ''}
              </span>
            </div>

            {websites.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {websites.map((site, index) => (
                  <WebsiteRow
                    key={site.id}
                    site={site}
                    errorCount={errorCountsByDomain[site.domain] || 0}
                    isLast={index === websites.length - 1}
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
