import { useState } from 'react'
import Seo from '@components/Seo'
import { supabase } from '@data/supabase/supabaseClient'
import { isValidEmail } from '@utils/validation'
import AuthShell, { Field } from './AuthShell'

const STATUS_ID = 'forgot-status'

// What the page says once the form has been sent, whoever it was sent for. The
// address either has an account or it does not, and the difference is not this
// page's to hand out: a form that answers differently for the two is a way to
// find out which addresses are registered.
const SENT_NOTE =
  'If that address has an account, a link to set a new password is on its way. The link works once and expires in an hour. If nothing arrives in a few minutes, check your spam folder, then send it again.'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    const address = email.trim()
    if (!isValidEmail(address)) {
      setError('Enter an email address in the form name@example.com.')
      return
    }
    setBusy(true)
    setError(null)
    await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSent(true)
    setBusy(false)
  }

  return (
    <>
      <Seo
        title="Reset Your Password"
        description="Ask for a link to set a new password on your TaylorURL console account."
        path="/forgot-password"
        noIndex
      />
      <AuthShell
        title="Forgot Password"
        blurb="Enter the email address on your account. A link to set a new password goes to it."
        statusId={STATUS_ID}
        error={error}
        busy={busy}
        submitLabel={sent ? 'Send Again' : 'Send Reset Link'}
        busyLabel="Sending"
        onSubmit={submit}
        alternative={{ to: '/login', lead: 'Remembered it?', label: 'Log in' }}
      >
        {sent && (
          <p className="auth-note" role="status">
            {SENT_NOTE}
          </p>
        )}
        <Field
          id="forgot-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
          autoFocus
          invalid={Boolean(error)}
          describedBy={STATUS_ID}
        />
      </AuthShell>
    </>
  )
}
