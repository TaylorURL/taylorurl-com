import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  SkipForward,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCommit,
  Github,
  RefreshCw,
  Loader2,
  Bug,
  Filter,
} from 'lucide-react'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { supabase } from '@app/lib/supabase'
import { pageTransition } from '@constants/animations'

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'skipped', label: 'Skipped' },
  { id: 'all', label: 'All' },
]

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
    icon: AlertTriangle,
  },
  fixed: {
    label: 'Fixed',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    icon: CheckCircle2,
  },
  skipped: {
    label: 'Skipped',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    icon: SkipForward,
  },
}

function getErrorStatus(error) {
  if (error.fixed) return 'fixed'
  if (error.skipped) return 'skipped'
  return 'open'
}

function formatTimeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function CommitLink({ commitHash, repo }) {
  if (!commitHash || !repo) return null
  const shortHash = commitHash.slice(0, 7)
  return (
    <a
      href={`https://github.com/${repo}/commit/${commitHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200"
    >
      <GitCommit className="h-3 w-3" />
      {shortHash}
    </a>
  )
}

function ErrorCard({ error }) {
  const [expanded, setExpanded] = useState(false)
  const status = getErrorStatus(error)
  const { label, color, bg, border, icon: StatusIcon } = STATUS_CONFIG[status]
  const hasStackInfo = error.stack_trace || error.component_stack

  return (
    <div className={`rounded-xl border bg-white ${border} overflow-hidden`}>
      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: message + meta */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${color}`}
              >
                <StatusIcon className="h-3 w-3" />
                {label}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                {error.project}
              </span>
              {error.error_count > 1 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                  {error.error_count}x
                </span>
              )}
              <span className="text-xs text-gray-400">{formatTimeAgo(error.created_at)}</span>
            </div>

            <p className="mb-1 font-medium leading-snug text-gray-900">{error.error_message}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              {error.source_file && (
                <span className="font-mono">
                  {error.source_file.split('/').pop()}
                  {error.line_number ? `:${error.line_number}` : ''}
                </span>
              )}
              {error.browser && <span>{error.browser}</span>}
              {error.os && <span>{error.os}</span>}
              {error.url && (
                <a
                  href={error.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-blue-600"
                >
                  {new URL(error.url).pathname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Right: links */}
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
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
            {error.fix_commit_hash && (
              <CommitLink commitHash={error.fix_commit_hash} repo={error.github_repo} />
            )}
            {hasStackInfo && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Stack
              </button>
            )}
          </div>
        </div>

        {/* Fix / skip notes */}
        {(error.fix_notes || error.skip_reason) && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {error.fix_notes || error.skip_reason}
          </p>
        )}
      </div>

      {/* Expandable stack trace */}
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
                  <p className="mb-1 mt-3 text-xs font-medium text-gray-500">Component Stack</p>
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

  const projects = ['all', ...new Set(errors.map(e => e.project))].sort()

  const visibleErrors = errors.filter(error => {
    const statusMatch = activeTab === 'all' || getErrorStatus(error) === activeTab
    const projectMatch = projectFilter === 'all' || error.project === projectFilter
    return statusMatch && projectMatch
  })

  const countByStatus = status => errors.filter(e => getErrorStatus(e) === status).length

  return (
    <motion.div {...pageTransition} className="min-h-screen bg-gray-50 pb-20 pt-28 md:pt-36">
      <Seo title="Error Tracker" description="Client-side error log." path="/errors" noIndex />

      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600">
              <Bug className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Error Tracker</h1>
              <p className="text-sm text-gray-500">
                {errors.length} total errors across all projects
              </p>
            </div>
          </div>
          <button
            onClick={loadErrors}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs */}
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {tab.id !== 'all' && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      activeTab === tab.id
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {countByStatus(tab.id)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Project filter */}
          {projects.length > 2 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {projects.map(p => (
                  <option key={p} value={p}>
                    {p === 'all' ? 'All Projects' : p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : visibleErrors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="font-medium text-gray-500">
              No {activeTab !== 'all' ? activeTab : ''} errors
            </p>
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
