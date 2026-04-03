import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Plus,
  ExternalLink,
} from 'lucide-react'

const STATUS_CONFIG = {
  active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-600', icon: CheckCircle2 },
  maintenance: {
    label: 'Maintenance',
    dot: 'bg-amber-500',
    text: 'text-amber-600',
    icon: AlertTriangle,
  },
  development: { label: 'Development', dot: 'bg-blue-500', text: 'text-blue-600', icon: Clock },
  down: { label: 'Down', dot: 'bg-red-500', text: 'text-red-600', icon: XCircle },
  paused: { label: 'Paused', dot: 'bg-gray-400', text: 'text-gray-500', icon: Clock },
}

/** Aggregate stats across all websites for the KPI ribbon. */
export function aggregateWebsiteStats(websites) {
  const totals = websites.reduce(
    (acc, site) => {
      const siteStats = site.website_stats?.[0]
      if (siteStats) {
        acc.visitors += siteStats.visitors_now || 0
        acc.pageViews += siteStats.page_views_30d || 0
        if (site.status === 'active' && siteStats.uptime_pct != null) {
          acc.uptimeSum += siteStats.uptime_pct
          acc.uptimeCount++
        }
      }
      return acc
    },
    { visitors: 0, pageViews: 0, uptimeSum: 0, uptimeCount: 0 }
  )

  return {
    totalOnlineNow: totals.visitors,
    totalPageViews: totals.pageViews,
    avgUptime: totals.uptimeCount > 0 ? (totals.uptimeSum / totals.uptimeCount).toFixed(1) : 0,
    totalSites: websites.length,
  }
}

/** Single stat cell inside the unified stats bar. */
export function StatCard({ label, value, period }) {
  return (
    <div className="bg-white px-6 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-400">{period}</p>
    </div>
  )
}

/** Compact metric used inside website rows. */
function InlineMetric({ label, value, highlight }) {
  return (
    <div className="text-right">
      <p
        className={`text-sm font-semibold tabular-nums ${highlight ? 'text-red-600' : 'text-gray-900'}`}
      >
        {value}
      </p>
      <p className="text-[10px] font-medium text-gray-400">{label}</p>
    </div>
  )
}

/** A single website as a table-like row inside a bordered container. */
export function WebsiteRow({ site, errorCount = 0, isLast }) {
  const siteStats = site.website_stats?.[0]
  const statusConfig = STATUS_CONFIG[site.status] || STATUS_CONFIG.active
  const uptimeDisplay = siteStats?.uptime_pct != null ? `${siteStats.uptime_pct}%` : '--'
  const isUpNow = siteStats?.is_up_now

  return (
    <div
      className={`flex flex-col gap-3 bg-white px-5 py-4 transition-colors hover:bg-gray-50/80 sm:flex-row sm:items-center sm:justify-between ${isLast ? '' : 'border-b border-gray-100'}`}
    >
      {/* Left: identity + status */}
      <div className="flex items-center gap-3.5 sm:min-w-0 sm:flex-1">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500">
          {(site.domain || site.name || '?')[0].toUpperCase()}
          {isUpNow != null && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-white ${isUpNow ? 'bg-emerald-500' : 'bg-red-500'}`}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{site.name}</p>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${statusConfig.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
              {statusConfig.label}
            </span>
          </div>
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-brand-600"
          >
            {site.domain}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* Right: metrics */}
      <div className="flex items-center gap-6 pl-12 sm:gap-8 sm:pl-0">
        <InlineMetric
          label="Online Now"
          value={(siteStats?.visitors_now || 0).toLocaleString()}
          highlight={false}
        />
        <InlineMetric
          label="Total Views"
          value={(siteStats?.page_views_30d || 0).toLocaleString()}
        />
        <InlineMetric label="Uptime" value={uptimeDisplay} />
        <InlineMetric label="Errors" value={errorCount} highlight={errorCount > 0} />
      </div>
    </div>
  )
}

/** Empty state shown when user has no websites. */
export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center"
    >
      <Globe className="mx-auto mb-4 h-10 w-10 text-gray-300" />
      <h3 className="mb-1.5 text-sm font-semibold text-gray-900">No websites yet</h3>
      <p className="mx-auto mb-6 max-w-xs text-sm text-gray-500">
        Your portfolio will appear here once your project is set up.
      </p>
      <Link
        to="/pricing"
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
      >
        <Plus className="h-4 w-4" />
        Get Started
      </Link>
    </motion.div>
  )
}

/** Skeleton loading state. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-10">
        <div className="h-3 w-36 rounded bg-gray-200" />
        <div className="mt-3 h-7 w-56 rounded bg-gray-200" />
      </div>
      <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white px-6 py-5">
            <div className="h-2.5 w-16 rounded bg-gray-200" />
            <div className="mt-3 h-6 w-14 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-3.5 bg-white px-5 py-4 ${i < 2 ? 'border-b border-gray-100' : ''}`}
          >
            <div className="h-9 w-9 rounded-lg bg-gray-200" />
            <div className="flex-1">
              <div className="h-3.5 w-28 rounded bg-gray-200" />
              <div className="mt-1.5 h-2.5 w-36 rounded bg-gray-100" />
            </div>
            <div className="flex gap-8">
              <div className="h-4 w-10 rounded bg-gray-200" />
              <div className="h-4 w-10 rounded bg-gray-200" />
              <div className="h-4 w-10 rounded bg-gray-200" />
              <div className="h-4 w-10 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
