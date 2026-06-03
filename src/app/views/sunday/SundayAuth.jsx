import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { signInWithPassword, useAuth } from '@hooks/useAuth'
import { SUNDAY_ROUTES } from '@constants/sunday/routes'

export default function SundayAuth() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loading && user) {
      navigate(SUNDAY_ROUTES.TODAY, { replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div
        className="sunday-root flex min-h-screen items-center justify-center font-mono text-[12px]"
        data-sunday-theme="dark"
        style={{
          background: 'var(--sunday-bg)',
          color: 'var(--sunday-text-muted)',
        }}
      >
        Loading…
      </div>
    )
  }
  if (user) return <Navigate to={SUNDAY_ROUTES.TODAY} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate(SUNDAY_ROUTES.TODAY, { replace: true })
  }

  return (
    <div
      className="sunday-root flex min-h-screen items-center justify-center px-6"
      data-sunday-theme="dark"
      style={{
        background: 'var(--sunday-bg)',
        backgroundImage: 'var(--sunday-bg-mesh)',
        color: 'var(--sunday-text)',
      }}
    >
      <Helmet>
        <title>Sunday — sign in</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <form
        onSubmit={handleSubmit}
        className="sunday-rise-in w-full max-w-[360px] space-y-5 rounded-lg border p-6"
        style={{
          background: 'var(--sunday-surface)',
          borderColor: 'var(--sunday-border-strong)',
        }}
      >
        <header className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded"
            style={{ background: 'var(--sunday-accent)', color: 'var(--sunday-on-accent)' }}
            aria-hidden="true"
          >
            <span className="text-[14px] font-bold leading-none">S</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-none tracking-tight">Sunday</h1>
            <p
              className="mt-1 font-mono text-[10.5px] uppercase leading-none tracking-[0.16em]"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              admin sign-in
            </p>
          </div>
        </header>

        <div className="space-y-3">
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>

        {error && (
          <p
            className="rounded border px-2.5 py-1.5 font-mono text-[11px]"
            style={{
              background: 'rgba(248,113,113,0.08)',
              borderColor: 'rgba(248,113,113,0.30)',
              color: 'var(--sunday-danger)',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="sunday-press inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium disabled:cursor-wait"
          style={{
            background: 'var(--sunday-accent)',
            color: 'var(--sunday-on-accent)',
            border: '1px solid var(--sunday-accent)',
            opacity: submitting ? 0.75 : 1,
          }}
        >
          {submitting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </div>
  )
}

function Field({ label, type, autoComplete, value, onChange }) {
  return (
    <label className="block space-y-1">
      <span
        className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
        style={{ color: 'var(--sunday-text-muted)' }}
      >
        {label}
      </span>
      <input
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border px-3 py-2 text-[13.5px]"
        style={{
          background: 'var(--sunday-bg-elevated)',
          borderColor: 'var(--sunday-border-strong)',
          color: 'var(--sunday-text)',
          transition: 'border-color 140ms var(--sunday-ease-out)',
        }}
      />
    </label>
  )
}
