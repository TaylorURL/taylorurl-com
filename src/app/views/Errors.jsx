import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderGit2,
  GitCommit,
  Github,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  SkipForward,
} from 'lucide-react'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { supabase } from '@app/lib/supabase'
import { pageTransition, staggerChildMount } from '@constants/animations'

const STATUS_TABS = ['open', 'fixed', 'skipped', 'all']

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    icon: AlertTriangle,
    pill: 'bg-red-50 text-red-600',
    dot: 'bg-red-500',
  },
  fixed: {
    label: 'Fixed',
    icon: CheckCircle2,
    pill: 'bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
  },
  skipped: {
    label: 'Skipped',
    icon: SkipForward,
    pill: 'bg-gray-100 text-gray-500',
    dot: 'bg-gray-400',
  },
}

const METRIC_CARDS = [
  {
    key: 'open',
    label: 'Open Errors',
    accent: 'text-red-600',
    bg: 'bg-red-50',
    icon: AlertTriangle,
  },
  {
    key: 'fixed',
    label: 'Fixed Errors',
    accent: 'text-emerald-600',
    bg: 'bg-emerald-50',
    icon: CheckCircle2,
  },
  { key: 'total', label: 'Total Errors', accent: 'text-blue-600', bg: 'bg-blue-50', icon: Bug },
  {
    key: 'projects',
    label: 'Projects',
    accent: 'text-violet-600',
    bg: 'bg-violet-50',
    icon: FolderGit2,
  },
]

/** Keywords in skip_reason that indicate the error still needs human attention. */
const ATTENTION_KEYWORDS =
  /\b(attention|review|look\s?at|investigate|check|revisit|todo|reopen|urgent|important|manual|needs?\s?fix)\b/i

/**
 * Derive display status from fixed/skipped booleans.
 * A skipped error whose skip_reason contains attention keywords is treated as open.
 */
function deriveStatus(error) {
  if (error.fixed) return 'fixed'
  if (error.skipped) {
    if (error.skip_reason && ATTENTION_KEYWORDS.test(error.skip_reason)) return 'open'
    return 'skipped'
  }
  return 'open'
}

/** Format a timestamp into a human-readable relative string. */
function formatRelativeTime(dateString) {
  const elapsedMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60_000)
  if (elapsedMinutes < 1) return 'just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  return `${Math.floor(elapsedHours / 24)}d ago`
}

function MetricsStrip({ errors }) {
  const openCount = errors.filter(e => deriveStatus(e) === 'open').length
  const fixedCount = errors.filter(e => deriveStatus(e) === 'fixed').length
  const projectCount = new Set(errors.map(e => e.project)).size

  const valueMap = {
    open: openCount,
    fixed: fixedCount,
    total: errors.length,
    projects: projectCount,
  }

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRIC_CARDS.map(({ key, label, accent, bg, icon: Icon }, index) => (
        <motion.div
          key={key}
          {...staggerChildMount(index, 0.07)}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {label}
            </span>
            <div className={`rounded-lg p-1.5 ${bg}`}>
              <Icon className={`h-4 w-4 ${accent}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{valueMap[key]}</p>
        </motion.div>
      ))}
    </div>
  )
}

function ErrorCard({ error }) {
  const [expanded, setExpanded] = useState(false)
  const status = deriveStatus(error)
  const { label, pill, dot, icon: StatusIcon } = STATUS_CONFIG[status]
  const hasStackInfo = error.stack_trace || error.component_stack
  const isReopenedFromSkip = error.skipped && status === 'open'

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {label}
          </span>
          {isReopenedFromSkip && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
              Needs Attention
            </span>
          )}
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
            {error.project}
          </span>
          {error.error_count > 1 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
              {error.error_count}x
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {formatRelativeTime(error.created_at)}
          </span>
        </div>

        <p
          className={`mb-3 font-semibold leading-snug text-gray-900 ${expanded ? '' : 'line-clamp-2'}`}
        >
          {error.error_message}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          {error.source_file && (
            <span className="font-mono text-gray-600">
              {error.source_file.split('/').pop()}
              {error.line_number ? `:${error.line_number}` : ''}
              {error.column_number ? `:${error.column_number}` : ''}
            </span>
          )}
          {error.browser && <span>{error.browser}</span>}
          {error.os && <span>{error.os}</span>}
          {error.url && (
            <a
              href={error.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-blue-600"
            >
              {new URL(error.url).pathname}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {error.github_issue_url && (
            <a
              href={error.github_issue_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Github className="h-3.5 w-3.5" />
              Issue #{error.github_issue_number}
            </a>
          )}
          {error.fix_commit_hash && error.github_repo && (
            <a
              href={`https://github.com/${error.github_repo}/commit/${error.fix_commit_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 font-mono text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <GitCommit className="h-3.5 w-3.5" />
              {error.fix_commit_hash.slice(0, 7)}
            </a>
          )}
          {hasStackInfo && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Stack Trace
            </button>
          )}
        </div>

        {(error.fix_notes || error.skip_reason) && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {error.fix_notes || error.skip_reason}
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasStackInfo && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="bg-gray-950 p-4">
              {error.stack_trace && (
                <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-gray-300">
                  {error.stack_trace}
                </pre>
              )}
              {error.component_stack && (
                <>
                  <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Component Stack
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-gray-300">
                    {error.component_stack}
                  </pre>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Errors() {
  const { profile, isStaff, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('open')
  const [projectFilter, setProjectFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (profile === null) return
    if (!isStaff() && !isAdmin()) {
      navigate('/dashboard', { replace: true })
      return
    }

    loadErrors()

    const subscription = supabase
      .channel('client_errors_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_errors' },
        payload => {
          setErrors(prev => [payload.new, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'client_errors' },
        payload => {
          setErrors(prev => prev.map(e => (e.id === payload.new.id ? payload.new : e)))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'client_errors' },
        payload => {
          setErrors(prev => prev.filter(e => e.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(subscription)
  }, [profile])

  const loadErrors = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('client_errors')
      .select('*')
      .order('error_count', { ascending: false })
      .order('created_at', { ascending: false })
    setErrors(data || [])
    setLoading(false)
  }

  const projects = useMemo(
    () => ['all', ...new Set(errors.map(e => e.project).filter(Boolean))].sort(),
    [errors]
  )

  const countByStatus = useMemo(() => {
    const counts = { open: 0, fixed: 0, skipped: 0 }
    errors.forEach(e => {
      counts[deriveStatus(e)]++
    })
    return counts
  }, [errors])

  const normalizedQuery = searchQuery.toLowerCase().trim()

  const visibleErrors = useMemo(
    () =>
      errors.filter(error => {
        if (activeTab !== 'all' && deriveStatus(error) !== activeTab) return false
        if (projectFilter !== 'all' && error.project !== projectFilter) return false
        if (normalizedQuery && !error.error_message?.toLowerCase().includes(normalizedQuery))
          return false
        return true
      }),
    [errors, activeTab, projectFilter, normalizedQuery]
  )

  const emptyMessage = activeTab !== 'all' ? `No ${activeTab} errors` : 'No errors found'

  return (
    <motion.div {...pageTransition} className="min-h-screen bg-gray-50 pb-20 pt-28 md:pt-36">
      <Seo
        title="Error Tracker"
        description="Client-side error monitoring."
        path="/errors"
        noIndex
      />

      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <Bug className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Error Tracker</h1>
              <p className="text-sm text-gray-500">
                {errors.length} error{errors.length !== 1 ? 's' : ''} across all projects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </a>
            <a
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              Admin
            </a>
            <button
              onClick={loadErrors}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Metrics */}
        <MetricsStrip errors={errors} />

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
            {STATUS_TABS.map(tabId => {
              const isActive = activeTab === tabId
              const tabLabel = tabId === 'all' ? 'All' : STATUS_CONFIG[tabId].label
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tabLabel}
                  {tabId !== 'all' && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs ${
                        isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {countByStatus[tabId]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search errors..."
                className="w-56 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {projects.length > 2 && (
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {projects.map(projectName => (
                  <option key={projectName} value={projectName}>
                    {projectName === 'all' ? 'All Projects' : projectName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Error list */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : visibleErrors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleErrors.map(error => (
              <ErrorCard key={error.id} error={error} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
