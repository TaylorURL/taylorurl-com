import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Globe,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  TrendingUp,
  Users,
  Eye,
  LogOut,
  Plus,
  RefreshCw,
  Loader2,
  Settings,
  ExternalLink,
  Activity,
} from 'lucide-react'
import { BRAND_NAME } from '@constants/navigation'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { supabase } from '@app/lib/supabase'

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
  maintenance: {
    label: 'Maintenance',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    icon: AlertTriangle,
  },
  development: { label: 'In Development', color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
  down: { label: 'Down', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
  paused: { label: 'Paused', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const toast = useToast()
  const [websites, setWebsites] = useState([])
  const [stats, setStats] = useState({ totalVisitors: 0, totalPageViews: 0, avgUptime: 0 })
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Client'

  useEffect(() => {
    loadWebsites()
  }, [])

  const loadWebsites = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('websites')
      .select('*, website_stats(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast('Failed to load websites', 'error')
      setLoading(false)
      return
    }

    setWebsites(data || [])

    // Aggregate stats
    const totals = (data || []).reduce(
      (acc, site) => {
        const s = site.website_stats?.[0]
        if (s) {
          acc.totalVisitors += s.visitors_30d || 0
          acc.totalPageViews += s.page_views_30d || 0
          acc.uptimeSum += s.uptime_pct || 0
          acc.uptimeCount++
        }
        return acc
      },
      { totalVisitors: 0, totalPageViews: 0, uptimeSum: 0, uptimeCount: 0 }
    )

    setStats({
      totalVisitors: totals.totalVisitors,
      totalPageViews: totals.totalPageViews,
      avgUptime: totals.uptimeCount > 0 ? (totals.uptimeSum / totals.uptimeCount).toFixed(1) : 0,
    })

    setLoading(false)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    toast('Signed out successfully')
  }

  const statusOf = site => STATUS_CONFIG[site.status] || STATUS_CONFIG.active

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-28 md:pt-36">
      <Seo
        title="Dashboard"
        description="Manage your websites and view analytics."
        path="/dashboard"
      />

      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-gray-500">Here&apos;s an overview of your websites.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadWebsites}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Total Visitors (30d)',
              value: stats.totalVisitors.toLocaleString(),
              icon: Users,
              color: 'text-blue-600',
            },
            {
              label: 'Page Views (30d)',
              value: stats.totalPageViews.toLocaleString(),
              icon: Eye,
              color: 'text-emerald-600',
            },
            {
              label: 'Avg. Uptime',
              value: stats.avgUptime ? `${stats.avgUptime}%` : '--',
              icon: Activity,
              color: 'text-violet-600',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Websites */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your Websites</h2>
          <span className="text-sm text-gray-400">
            {websites.length} site{websites.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : websites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center"
          >
            <Globe className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No websites yet</h3>
            <p className="mb-6 text-sm text-gray-500">
              Your websites will appear here once your project is set up by TaylorURL.
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Get Started
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {websites.map((site, i) => {
              const st = statusOf(site)
              const StatusIcon = st.icon
              const s = site.website_stats?.[0]

              return (
                <motion.div
                  key={site.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <Globe className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{site.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {st.label}
                          </span>
                        </div>
                        <a
                          href={`https://${site.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
                        >
                          {site.domain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      {s && (
                        <>
                          <div className="text-center">
                            <p className="font-semibold text-gray-900">
                              {(s.visitors_30d || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400">Visitors</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-gray-900">
                              {(s.page_views_30d || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400">Page Views</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-gray-900">{s.uptime_pct ?? '--'}%</p>
                            <p className="text-xs text-gray-400">Uptime</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {site.notes && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                      {site.notes}
                    </p>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
