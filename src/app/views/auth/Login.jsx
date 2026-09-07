import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import ConsoleShell from '@components/account/ConsoleShell'
import Seo from '@components/Seo'
import Waiting from '@components/app-shell/Waiting'
import { useDeferredWait } from '@hooks/chrome/useDeferredWait'
import { useToast } from '@hooks/chrome/useToast'
import { useSession } from '@hooks/session/useSession'
import AuthShell, { Field } from './AuthShell'
import { nextScreen } from './lib/screen'

export default function Login() {
  const {
    session,
    checking,
    busy,
    error,
    mfaPending,
    signIn,
    signOut,
    verifyMfa,
    redeemRecovery,
    clearError,
  } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const toast = useToast()
  const location = useLocation()
  const [query] = useSearchParams()
  // Whether a form has been on screen yet, which is what decides between
  // holding the one already there and drawing a placeholder in place of one
  // that never was.
  const drawn = useRef(false)

  // A refused sign-in is not about one field. Supabase answers a wrong address
  // and a wrong password with one message on purpose, and a code the
  // authenticator app disagrees with is about that app rather than about the
  // box the six digits were typed into - so none of the three belong under an
  // input. They are read off the session as they arrive rather than at each of
  // the three calls that can raise one, because a call site added later is a
  // call site that forgets. Clearing it is what stops the same refusal being
  // announced a second time when the screen changes underneath it.
  useEffect(() => {
    if (!error) return
    toast(error, 'error')
    clearError()
  }, [error, toast, clearError])

  // Where the visitor was headed before being asked to sign in, so arriving at
  // a page and being sent back to it is one step rather than a fresh search.
  const next = location.state?.from || '/console'

  // A buyer who reached this screen from the one after a payment came looking
  // for an account they may not have. The way back has to carry the checkout,
  // or the round trip costs them the address the build is waiting under - which
  // is the whole failure that screen fills the field in to prevent.
  const session_id = query.get('session_id')
  const signupHref =
    query.get('bought') === '1' && session_id
      ? `/signup?bought=1&session_id=${encodeURIComponent(session_id)}`
      : '/signup'

  // A session in hand that owes nothing is a sign-in that is over.
  const leaving = !checking && session && !mfaPending
  // The account is still being worked out, and `mfaPending` is the answer from
  // before it changed hands.
  const settling = checking && Boolean(session)
  const wait = useDeferredWait(settling && !drawn.current)

  // Which of the three screens is up, and it stops moving once the sign-in is
  // over: what is left then is a page being left, and the transition above
  // fades away whatever this last drew. Choosing again on the way out swaps the
  // screen for another one nobody asked for, and that is what gets faded.
  const screen = useRef('password')
  screen.current = nextScreen(screen.current, {
    leaving,
    waiting: wait.blocked,
    pending: mfaPending,
  })
  // A form on screen stays on screen while the account settles: swapping it for
  // a placeholder empties the page between two steps that read as one, and the
  // submit already says the work is in hand.
  if (screen.current !== 'wait') drawn.current = true
  const working = busy || settling

  // Leaving is declared in the render that finds the sign-in finished rather
  // than run from an effect afterwards. An effect lets this screen paint once
  // more first, and the transition carries that paint across as the page being
  // left - which is how the sign-in form comes back for a moment on the way to
  // the console.
  const exit = leaving ? <Navigate to={next} replace /> : null

  // An account read back from storage has chosen no screen yet, and a form is
  // the wrong guess for somebody already signed in. Nothing is drawn to keep,
  // so this waits for the answer rather than showing a form to take away.
  if (screen.current === 'wait') {
    return (
      <>
        {exit}
        <Seo title="Log In" description="Sign in to the TaylorURL console." path="/login" noIndex />
        <ConsoleShell>
          <Waiting visible={wait.visible} label="Checking session" />
        </ConsoleShell>
      </>
    )
  }

  if (screen.current === 'code') {
    return (
      <>
        {exit}
        <Seo
          title="Two-Factor Authentication"
          description="Confirm the code from your authenticator app to open the TaylorURL console for your site."
          path="/login"
          noIndex
        />
        <AuthShell
          title="Two-Factor Authentication"
          blurb={
            recovery
              ? 'Enter one of the recovery codes saved when two-factor authentication was switched on.'
              : 'Enter the six-digit code from your authenticator app.'
          }
          formName="two-factor"
          autoComplete="off"
          busy={working}
          submitLabel="Verify"
          busyLabel="Checking"
          onSubmit={() => {
            const typed = code.trim()
            if (!typed) return
            const done = recovery ? redeemRecovery(typed) : verifyMfa(typed)
            done.then(ok => {
              if (ok) setCode('')
            })
          }}
        >
          <Field
            id="login-code"
            label={recovery ? 'Recovery code' : 'Authentication code'}
            type="text"
            value={code}
            onChange={setCode}
            autoComplete="one-time-code"
            autoFocus
          />
          <p className="auth-aside">
            <button
              type="button"
              className="auth-alt-link"
              onClick={() => {
                setRecovery(open => !open)
                setCode('')
                clearError()
              }}
            >
              {recovery ? 'Use Authenticator Code' : 'Use Recovery Code'}
            </button>
            <button type="button" className="auth-aside-quiet" onClick={signOut}>
              Cancel
            </button>
          </p>
        </AuthShell>
      </>
    )
  }

  return (
    <>
      {exit}
      <Seo
        title="Log In"
        description="Sign in to the TaylorURL console for your site."
        path="/login"
        noIndex
      />
      <AuthShell
        title="Log In"
        blurb="Sign in to see the traffic figures for your site."
        formName="sign-in"
        busy={working}
        submitLabel="Log In"
        busyLabel="Signing In"
        onSubmit={() => signIn(email.trim(), password)}
        alternative={{ to: signupHref, lead: 'No account yet?', label: 'Sign up' }}
      >
        <Field
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
          autoFocus
        />
        <div>
          <Field
            id="login-password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <p className="auth-aside">
            <Link to="/forgot-password" className="auth-alt-link">
              Forgot Password
            </Link>
          </p>
        </div>
      </AuthShell>
    </>
  )
}
