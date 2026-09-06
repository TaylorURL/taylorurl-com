import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Seo from '@components/Seo'
import { supabase } from '@data/supabaseClient'
import AuthShell, { Field } from './auth/AuthShell'

const STATUS_ID = 'reset-status'
// Supabase refuses anything shorter, and finding that out from the server after
// filling the form in is a worse way to learn it.
const MIN_PASSWORD = 6
// How long the confirmation holds before the console opens behind it.
const HANDOVER_MS = 1400

/**
 * Take the recovery link's credentials and turn them into a session.
 *
 * The client is built with detectSessionInUrl off, because every other page is
 * reached by typing its address rather than by following a link back from an
 * email. This route is the one exception, so it reads the link itself: a code
 * in the query for the exchange flow, a token pair in the fragment otherwise.
 *
 * @returns {Promise<boolean>} whether a session now stands
 */
async function adoptRecovery() {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    return !error
  }

  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return !error
  }

  // A reload of this page after the link was already spent: the session is
  // held, and the form still works.
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

export default function ResetPassword() {
  const [stage, setStage] = useState('reading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    adoptRecovery().then(ok => {
      if (cancelled) return
      setStage(ok ? 'ready' : 'expired')
      // The credentials came in on the address bar and have no business
      // staying there, where a shared screen or a copied link carries them on.
      if (ok) window.history.replaceState({}, '', '/reset-password')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (stage !== 'done') return undefined
    const timer = window.setTimeout(() => navigate('/console', { replace: true }), HANDOVER_MS)
    return () => window.clearTimeout(timer)
  }, [stage, navigate])

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for the password.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords are different. Type the same one in both fields.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: cause } = await supabase.auth.updateUser({ password })
    if (cause) setError(cause.message)
    else setStage('done')
    setBusy(false)
  }

  const head = (
    <Seo
      title="Set a New Password"
      description="Set a new password on your TaylorURL console account from the link sent to your address."
      path="/reset-password"
      noIndex
    />
  )

  if (stage === 'reading') {
    return (
      <>
        {head}
        <AuthShell
          title="Set a New Password"
          blurb="Checking the link."
          statusId={STATUS_ID}
          error={null}
          busy
          submitLabel="Set Password"
          busyLabel="Checking"
          onSubmit={() => {}}
        >
          <p className="auth-note" role="status">
            Reading the link from your email.
          </p>
        </AuthShell>
      </>
    )
  }

  if (stage === 'expired') {
    return (
      <>
        {head}
        <AuthShell
          title="Set a New Password"
          blurb="This link has expired or has already been used."
          statusId={STATUS_ID}
          error={null}
          busy={false}
          submitLabel="Request a New Link"
          busyLabel="Opening"
          onSubmit={() => navigate('/forgot-password')}
          alternative={{ to: '/login', lead: 'Know your password?', label: 'Log in' }}
        >
          <p className="auth-note" role="status">
            A reset link works once and expires an hour after it is sent. Ask for another and use
            the newest email.
          </p>
        </AuthShell>
      </>
    )
  }

  return (
    <>
      {head}
      <AuthShell
        title="Set a New Password"
        blurb="Choose the password you will sign in with."
        statusId={STATUS_ID}
        error={error}
        busy={busy || stage === 'done'}
        submitLabel="Set Password"
        busyLabel={stage === 'done' ? 'Opening the Console' : 'Saving'}
        onSubmit={submit}
        alternative={{ to: '/login', lead: 'Know your password?', label: 'Log in' }}
      >
        {stage === 'done' && (
          <p className="auth-note" role="status">
            Your password is set. The console opens next.
          </p>
        )}
        <Field
          id="reset-password"
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          autoFocus
          invalid={Boolean(error)}
          describedBy={STATUS_ID}
        />
        <Field
          id="reset-confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={Boolean(error)}
          describedBy={STATUS_ID}
        />
      </AuthShell>
    </>
  )
}
