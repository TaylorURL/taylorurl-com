import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  Bug,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  SkipForward,
} from 'lucide-react'
import Seo from '@components/Seo'
import { ErrorCard, ERROR_STATUS_CONFIG, ATTENTION_KEYWORDS, deriveErrorStatus } from '@components/ErrorCard'
import { useAuth } from '@app/contexts/AuthContext'
import { supabase } from '@app/lib/supabase'
import { pageTransition } from '@constants/animations'

const STATUS_TABS = ['open', 'closed', 'fixed', 'skipped', 'all']

// Local alias so the rest of this file doesn't need changes
const STATUS_CONFIG = ERROR_STATUS_CONFIG
const deriveStatus = deriveErrorStatus

function MetricsStrip({ errors }) {
  const openCount = errors.filter(e => deriveStatus(e) === 'open').length
  const fixedCount = errors.filter(e => deriveStatus(e) === 'fixed').length
  const projectCount = new Set(errors.map(e => e.project)).size

  const metrics = [
    { label: 'Open', value: openCount },
    { label: 'Fixed', value: fixedCount },
    { label: 'Total', value: errors.length },
    { label: 'Projects', value: projectCount },
  ]

  return (
    <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 lg:grid-cols-4">
      {metrics.map(({ label, value }) => (
        <div key={label} className="bg-white px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">
            {value}
          </p>
        </div>
      ))}
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
  }, [profile, navigate])

  const syncGithubIssueStates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/error-reporting-service/sync-issue-states`,
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
    } catch {
      // Best-effort sync — don't block the UI
    }
  }

  const loadErrors = async () => {
    setLoading(true)

    // Sync GitHub issue states in background before fetching
    await syncGithubIssueStates()

    const { data } = await supabase
      .from('client_errors')
      .select('*')
      .order('error_count', { ascending: false })
      .order('created_at', { ascending: false })
    setErrors(data || [])
    setLoading(false)

    // Auto-create GitHub issues for "needs attention" errors that don't have one yet
    const attentionWithoutIssue = (data || []).filter(
      e => e.skipped && !e.github_issue_url && e.skip_reason && ATTENTION_KEYWORDS.test(e.skip_reason)
    )
    for (const errorRow of attentionWithoutIssue) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) break
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/error-reporting-service/create-attention-issue`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ id: errorRow.id }),
          }
        )
        if (response.ok) {
          const result = await response.json()
          if (result.created) {
            setErrors(prev =>
              prev.map(e =>
                e.id === errorRow.id
                  ? {
                      ...e,
                      github_issue_number: result.issue.issueNumber,
                      github_issue_url: result.issue.issueUrl,
                      github_repo: result.issue.repo,
                    }
                  : e
              )
            )
          }
        }
      } catch {
        // Silently continue — issue creation is best-effort
      }
    }
  }

  const projects = useMemo(
    () => ['all', ...new Set(errors.map(e => e.project).filter(Boolean))].sort(),
    [errors]
  )

  const countByStatus = useMemo(() => {
    const counts = { open: 0, closed: 0, fixed: 0, skipped: 0 }
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
    <motion.div {...pageTransition}>
      <Seo
        title="Error Tracker"
        description="Client-side error monitoring."
        path="/errors"
        noIndex
      />

      {/* Header */}
      <header className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">
            {errors.length} error{errors.length !== 1 ? 's' : ''} across all projects
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Error Tracker
          </h1>
        </div>
        <button
          onClick={loadErrors}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Metrics */}
      <MetricsStrip errors={errors} />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-200 p-px">
          {STATUS_TABS.map(tabId => {
            const isActive = activeTab === tabId
            const tabLabel = tabId === 'all' ? 'All' : STATUS_CONFIG[tabId].label
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-1.5 rounded-[7px] px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tabLabel}
                {tabId !== 'all' && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                      isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-300/60 text-gray-500'
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
              className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
    </motion.div>
  )
}
