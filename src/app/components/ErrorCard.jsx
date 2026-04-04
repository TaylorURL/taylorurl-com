import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCommit,
  Github,
  SkipForward,
} from 'lucide-react'

export const ERROR_STATUS_CONFIG = {
  open: {
    label: 'Open',
    icon: AlertTriangle,
    pill: 'bg-red-50 text-red-600',
    dot: 'bg-red-500',
  },
  closed: {
    label: 'Closed',
    icon: Archive,
    pill: 'bg-blue-50 text-blue-600',
    dot: 'bg-blue-500',
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

/** Keywords in skip_reason that indicate the error still needs human attention. */
export const ATTENTION_KEYWORDS =
  /\b(attention|review|look\s?at|investigate|check|revisit|todo|reopen|urgent|important|manual|needs?\s?fix)\b/i

/**
 * Derive display status from fixed/skipped booleans and GitHub issue state.
 * Priority: fixed > GitHub issue closed > skipped (with attention keyword check) > open.
 */
export function deriveErrorStatus(error) {
  if (error.fixed) return 'fixed'
  if (error.github_issue_state === 'closed') return 'closed'
  if (error.skipped) {
    if (error.skip_reason && ATTENTION_KEYWORDS.test(error.skip_reason)) return 'open'
    return 'skipped'
  }
  return 'open'
}

export function formatRelativeTime(dateString) {
  const elapsedMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60_000)
  if (elapsedMinutes < 1) return 'just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h ago`
  return `${Math.floor(elapsedHours / 24)}d ago`
}

export function ErrorCard({ error, hideProject = false }) {
  const [expanded, setExpanded] = useState(false)
  const status = deriveErrorStatus(error)
  const { label, pill, dot } = ERROR_STATUS_CONFIG[status]
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
          {!hideProject && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
              {error.project}
            </span>
          )}
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
              {(() => {
                try {
                  return new URL(error.url).pathname
                } catch {
                  return error.url
                }
              })()}
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
