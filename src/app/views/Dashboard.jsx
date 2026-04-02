import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Users,
  Eye,
  Activity,
  LayoutGrid,
  LogOut,
  Plus,
  RefreshCw,
  Loader2,
  Settings,
  ExternalLink,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { supabase } from '@app/lib/supabase'
import { staggerChildMount } from '@constants/animations'

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-600/20',
    icon: CheckCircle2,
  },
  maintenance: {
    label: 'Maintenance',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-600/20',
    icon: AlertTriangle,
  },
  development: {
    label: 'In Development',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: 'ring-blue-600/20',
    icon: Clock,
  },
  down: {
    label: 'Down',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-600/20',
    icon: XCircle,
  },
  paused: {
    label: 'Paused',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    ring: 'ring-gray-500/20',
    icon: Clock,
  },
}

const STATS_DEFINITIONS = [
  {
    key: 'totalVisitors',
    label: 'Total Visitors',
    icon: Users,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    format: v => v.toLocaleString(),
  },
  {
    key: 'totalPageViews',
    label: 'Page Views',
    icon: Eye,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    format: v => v.toLocaleString(),
  },
  {
    key: 'avgUptime',
    label: 'Avg Uptime',
    icon: Activity,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    format: v => (v ? `${v}%` : '--'),
  },
  {
    key: 'totalSites',
    label: 'Total Sites',
    icon: LayoutGrid,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    format: v => v,
  },
]

const DOMAIN_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
]

function domainInitialColor(domain) {
  const charCode = (domain || '').charCodeAt(0) || 0
  return DOMAIN_COLORS[charCode % DOMAIN_COLORS.length]
}

function formatRelativeTimestamp(dateString) {
  if (!dateString) return null
  const secondsAgo = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (secondsAgo < 60) return 'just now'
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`
  return `${Math.floor(secondsAgo / 86400)}d ago`
}

function aggregateWebsiteStats(websites) {
  const totals = websites.reduce(
    (acc, site) => {
      const siteStats = site.website_stats?.[0]
      if (siteStats) {
        acc.totalVisitors += siteStats.visitors_30d || 0
        acc.totalPageViews += siteStats.page_views_30d || 0
        acc.uptimeSum += siteStats.uptime_pct || 0
        acc.uptimeCount++
      }
      return acc
    },
    { totalVisitors: 0, totalPageViews: 0, uptimeSum: 0, uptimeCount: 0 }
  )

  return {
    totalVisitors: totals.totalVisitors,
    totalPageViews: totals.totalPageViews,
    avgUptime: totals.uptimeCount > 0 ? (totals.uptimeSum / totals.uptimeCount).toFixed(1) : 0,
    totalSites: websites.length,
  }
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.bg} ${config.color} ${config.ring}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

function StatCard({ definition, value, index }) {
  const Icon = definition.icon
  return (
    <motion.div
      {...staggerChildMount(index, 0.07)}
      className="rounded-xl border border-gray-200 bg-white p-5"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${definition.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${definition.iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{definition.label}</p>
          <p className="text-xl font-bold tracking-tight text-gray-900">
            {definition.format(value)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function WebsiteCard({ site, index }) {
  const siteStats = site.website_stats?.[0]
  const updatedLabel = formatRelativeTimestamp(siteStats?.updated_at)
  const domainFirstLetter = (site.domain || site.name || '?')[0].toUpperCase()

  return (
    <motion.article
      {...staggerChildMount(index, 0.06)}
      className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-lg"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${domainInitialColor(site.domain)}`}
          >
            {domainFirstLetter}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-gray-900">{site.name}</h3>
              <StatusBadge status={site.status} />
            </div>
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-blue-600"
            >
              {site.domain}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {siteStats && (
          <div className="flex items-center gap-6 text-sm">
            <InlineMetric label="Visitors" value={(siteStats.visitors_30d || 0).toLocaleString()} />
            <InlineMetric
              label="Page Views"
              value={(siteStats.page_views_30d || 0).toLocaleString()}
            />
            <InlineMetric
              label="Uptime"
              value={siteStats.uptime_pct != null ? `${siteStats.uptime_pct}%` : '--'}
            />
          </div>
        )}
      </div>

      {(site.notes || updatedLabel) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {updatedLabel && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              Updated {updatedLabel}
            </span>
          )}
          {site.notes && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
              <MessageSquare className="h-3 w-3 shrink-0 text-gray-400" />
              {site.notes}
            </span>
          )}
        </div>
      )}
    </motion.article>
  )
}

function InlineMetric({ label, value }) {
  return (
    <div className="text-center">
      <p className="font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-dashed border-gray-300 bg-white py-20 text-center"
    >
      <Globe className="mx-auto mb-4 h-12 w-12 text-gray-300" />
      <h3 className="mb-2 text-lg font-semibold text-gray-900">No websites yet</h3>
      <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
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
  )
}

export default function Dashboard() {
  const { user, signOut, isStaff, isAdmin, profile } = useAuth()
  const toast = useToast()
  const [websites, setWebsites] = useState([])
  const [stats, setStats] = useState({
    totalVisitors: 0,
    totalPageViews: 0,
    avgUptime: 0,
    totalSites: 0,
  })
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Client'
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const hasElevatedAccess = isStaff() || isAdmin()

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    fetchWebsites()
  }, [])

  async function fetchWebsites() {
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

    const siteData = data || []
    setWebsites(siteData)
    setStats(aggregateWebsiteStats(siteData))
    setLoading(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    toast('Signed out successfully')
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 pt-28 md:pt-36">
      <Seo
        title="Dashboard"
        description="Manage your websites and view analytics."
        path="/dashboard"
      />

      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Welcome back, {displayName}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">{todayFormatted}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasElevatedAccess && (
              <>
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  <Settings className="h-4 w-4" />
                  Admin Panel
                </Link>
                <Link
                  to="/errors"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <AlertCircle className="h-4 w-4" />
                  Errors
                </Link>
              </>
            )}
            <button
              onClick={fetchWebsites}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign Out
            </button>
          </div>
        </header>

        {/* Stats Strip */}
        <section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS_DEFINITIONS.map((definition, index) => (
            <StatCard
              key={definition.key}
              definition={definition}
              value={stats[definition.key]}
              index={index}
            />
          ))}
        </section>

        {/* Websites Section */}
        <section>
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
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {websites.map((site, index) => (
                <WebsiteCard key={site.id} site={site} index={index} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
