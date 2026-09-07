import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import ConsoleShell from '@components/account/ConsoleShell'
import Seo from '@components/Seo'
import Waiting from '@components/app-shell/Waiting'
import { useDeferredWait } from '@hooks/chrome/useDeferredWait'
import { useToast } from '@hooks/chrome/useToast'
import { useSession } from '@hooks/session/useSession'
import { paidBuyer } from '@data/checkout/checkoutSession'
import AuthShell, { Field } from './AuthShell'
import { nextScreen } from './lib/screen'

const STATUS_ID = 'signup-status'

/*
 * The two accounts this screen makes, and what each of them is for.
 *
 * Most people arrive here to read the figures for a site that already exists.
 * A buyer arrives straight off a payment, and for them the account is not a way
 * into a report but the only way back to the build they have just paid for: the
 * project is waiting under the address they paid with, and picking a password
 * is what claims it. Told the wrong one of those, a buyer reads a screen about
 * traffic on a site that does not exist yet and reasonably wonders what they
 * have bought.
 */
const ARRIVALS = {
  bought: {
    title: 'Pick a Password',
    blurb: 'Your payment landed. Pick a password and your build opens.',
    seo: 'Claim the build you have paid for.',
  },
  plain: {
    title: 'Sign Up',
    blurb: 'Create an account to see the traffic figures for your site.',
    seo: 'Create a TaylorURL account to open the console for your site.',
  },
}
// Supabase refuses anything shorter, and finding that out from the server after
// filling the form in is a worse way to learn it.
const MIN_PASSWORD = 6

export default function Signup() {
  const { session, checking, busy, error, signUp, clearError } = useSession()
  const [query] = useSearchParams()
  const bought = query.get('bought') === '1'
  const arrival = bought ? ARRIVALS.bought : ARRIVALS.plain
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  // The business the checkout was opened for, which the panel beside the form
  // names back. Nothing is drawn in its place while the lookup is out, so a
  // buyer never watches a heading rewrite itself.
  const [business, setBusiness] = useState(null)
  const [password, setPassword] = useState('')
  // The one rule this form checks for itself, which is the one thing here that
  // is about a single box and stays under it.
  const [local, setLocal] = useState(null)
  // Set when the account was made but no session came back, which means
  // Supabase is holding it until the address is confirmed.
  const [confirming, setConfirming] = useState(false)
  // Whether a form has been on screen yet, which is what decides between
  // holding the one already there and drawing a placeholder in place of one
  // that never was.
  const drawn = useRef(false)
  const toast = useToast()

  // Everything that can refuse an account is about the account or the service
  // rather than about one of the three boxes - an address already signed up, a
  // password the server thinks too weak, a connection that dropped - so it is
  // said in the corner rather than under a field it does not name. Clearing it
  // is what stops the same refusal being read out again on the next render
  // that touches this screen.
  useEffect(() => {
    if (!error) return
    toast(error, 'error')
    clearError()
  }, [error, toast, clearError])

  // What the checkout already knows about the buyer, filled in rather than
  // merely suggested. The address is the one that matters: the build is waiting
  // under the address the payment was made with, and the whole failure this
  // prevents is somebody typing a different one out of habit and landing in a
  // console with no build in it. The name is filled for the same reason it was
  // collected - it is theirs, they are about to type it, and a form that
  // already knows it reads as one that was expecting them.
  //
  // Each field stands down the moment it is typed into, separately, so
  // correcting the name does not freeze the address in whatever the lookup had
  // reached by then.
  //
  // Nothing is said when the lookup fails. The buyer can still type all of it
  // and still get an account, and a red line about a session id is a worry
  // about our plumbing handed to somebody who just paid.
  const session_id = query.get('session_id')
  // The way to the login screen, carrying the checkout with it. A buyer who
  // taps this because they think they already have an account has to be able
  // to come back, and a bare `/login` throws away the one string that knows
  // which purchase they are in the middle of claiming.
  const loginHref =
    bought && session_id ? `/login?bought=1&session_id=${encodeURIComponent(session_id)}` : '/login'
  const touchedEmail = useRef(false)
  const touchedName = useRef(false)
  useEffect(() => {
    if (!session_id) return undefined
    let alive = true
    paidBuyer(session_id).then(found => {
      if (!alive || !found) return
      if (found.email && !touchedEmail.current) setEmail(found.email)
      if (found.name && !touchedName.current) setFullName(found.name)
      if (found.business) setBusiness(found.business)
    })
    return () => {
      alive = false
    }
  }, [session_id])

  // The account is still being read back.
  const settling = checking && Boolean(session)
  const wait = useDeferredWait(settling && !drawn.current)

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setLocal(`Use at least ${MIN_PASSWORD} characters for the password.`)
      return
    }
    setLocal(null)
    const made = await signUp(email.trim(), password, fullName.trim())
    if (made.confirming) setConfirming(true)
  }

  const leaving = !checking && Boolean(session)

  // Which of the two screens is up, and it stops moving once the account is in
  // hand: what is left then is a page being left, and the transition above
  // fades away whatever this last drew.
  const screen = useRef('password')
  screen.current = nextScreen(screen.current, {
    leaving,
    waiting: wait.blocked,
    pending: false,
  })
  if (screen.current !== 'wait') drawn.current = true

  // Leaving is declared in the render that finds the account in hand rather
  // than run from an effect afterwards. An effect lets this screen paint once
  // more first, and the transition carries that paint across as the page being
  // left.
  const exit = leaving ? <Navigate to="/console" replace /> : null

  // An account read back from storage has chosen no screen yet, and a form is
  // the wrong guess for somebody already signed in.
  if (screen.current === 'wait') {
    return (
      <>
        {exit}
        <Seo
          title="Sign Up"
          description="Create a TaylorURL account to open the TaylorURL console."
          path="/signup"
          noIndex
        />
        <ConsoleShell>
          <Waiting visible={wait.visible} label="Checking session" />
        </ConsoleShell>
      </>
    )
  }

  // The account exists and the next step is in an inbox. Said plainly and with
  // the address repeated back, because the one thing a person needs here is to
  // know which of their addresses to go and look in - and because the screen
  // this replaces said nothing at all and simply un-greyed its button.
  if (confirming) {
    return (
      <>
        <Seo title="Confirm Your Email" description={arrival.seo} path="/signup" noIndex />
        <AuthShell
          title="Check Your Email"
          blurb={
            bought
              ? `Your account is made. Confirm ${email.trim()} and your build opens.`
              : `Your account is made. Confirm ${email.trim()} to finish.`
          }
          formName="sign-up-sent"
          alternative={{ to: loginHref, lead: 'Already confirmed?', label: 'Log in' }}
        >
          <p className="auth-note">
            The link lands within a minute or two. If nothing arrives, check the spam folder before
            trying again - a second signup on the same address will not send a second link.
          </p>
        </AuthShell>
      </>
    )
  }

  return (
    <>
      {exit}
      <Seo title={arrival.title} description={arrival.seo} path="/signup" noIndex />
      <AuthShell
        title={arrival.title}
        blurb={arrival.blurb}
        statusId={STATUS_ID}
        formName="sign-up"
        error={local}
        busy={busy || settling}
        submitLabel="Sign Up"
        busyLabel="Creating Account"
        onSubmit={submit}
        alternative={{ to: loginHref, lead: 'Already have an account?', label: 'Log in' }}
        bought={bought}
        business={business}
      >
        <Field
          id="signup-name"
          label="Name"
          type="text"
          value={fullName}
          onChange={value => {
            touchedName.current = true
            setFullName(value)
          }}
          autoComplete="name"
          autoFocus={!fullName}
        />
        <Field
          id="signup-email"
          label="Email"
          type="email"
          value={email}
          onChange={value => {
            // Once somebody has typed here the lookup stops being help and
            // starts being an argument, so it stands down for good.
            touchedEmail.current = true
            setEmail(value)
          }}
          autoComplete="username"
        />
        <Field
          id="signup-password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          invalid={Boolean(local)}
          describedBy={STATUS_ID}
        />
      </AuthShell>
    </>
  )
}
