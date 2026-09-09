import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import ConsoleShell from '@components/account/ConsoleShell'
import Seo from '@components/Seo'
import Waiting from '@components/app-shell/Waiting'
import { useDeferredWait } from '@hooks/chrome/useDeferredWait'
import { useSession } from '@hooks/session/useSession'
import { supabase } from '@data/supabase/supabaseClient'
import { claimCheckout } from '@data/checkout/checkoutClaim'
import AuthShell from './AuthShell'
import { welcomeScreen } from './lib/screen'

/*
 * Where a buyer lands the moment Stripe is done with them.
 *
 * Nothing is asked for here. The account was made when the payment landed, the
 * project is already on it, and the whole of this screen's job is to spend the
 * key the return address carries and put the buyer in their console. Done
 * quickly enough, nobody reads a word of it: the wait is deferred, so a claim
 * that settles in a few hundred milliseconds draws nothing at all and Stripe
 * appears to hand straight over to the tracker.
 *
 * The key comes out of the address bar as soon as it has been read. It is a
 * credential for one sign-in and the address bar is the one place on this site
 * that gets screenshotted, pasted into a support thread and kept in history, so
 * it is replaced rather than left standing. The session id stays, because a
 * refresh after that has to be able to name the address the build is under.
 *
 * What is left when the key does not work is the second screen. That is not an
 * error to report - the build is paid for and open either way, and every reason
 * a key fails is a reason the buyer had no part in - so it says the one thing
 * they need, which is that the account is theirs and a password is how they
 * open it.
 */

export default function Welcome() {
  const { session, email: signedInAs, checking } = useSession()
  const [query] = useSearchParams()
  const navigate = useNavigate()
  // Who paid, as the endpoint reads it back off the session. Nothing is drawn
  // in its place while the lookup is out, so a buyer never watches a heading
  // rewrite itself.
  const [buyer, setBuyer] = useState(null)
  // Whether the key has been spent, whichever way it went.
  const [settled, setSettled] = useState(false)
  // Whether it was spent for a session on this browser, which is the only
  // outcome that ends with a console rather than a screen.
  const [signedIn, setSignedIn] = useState(false)
  // One claim per arrival. The key works once, and a second call spends nothing
  // and answers with the screen that says so.
  const claimed = useRef(false)

  useEffect(() => {
    if (claimed.current) return
    claimed.current = true

    const id = query.get('session_id')
    const key = query.get('claim')

    claimCheckout(id, key).then(async found => {
      if (found) setBuyer(found)
      // The key is spent by the answer above, so it has no further use and no
      // business staying in the address bar.
      if (key) {
        navigate(id ? `/welcome?session_id=${encodeURIComponent(id)}` : '/welcome', {
          replace: true,
        })
      }
      if (found?.token) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: found.token,
          type: found.type || 'magiclink',
        })
        if (!error) setSignedIn(true)
      }
      setSettled(true)
    })
  }, [navigate, query])

  // An account already in hand under the address that paid is the repeat buyer,
  // and sending them anywhere but their own console would be wrong however the
  // key went.
  const alreadyTheirs = Boolean(
    buyer?.email && signedInAs && buyer.email.toLowerCase() === signedInAs.toLowerCase()
  )

  const leaving = !checking && Boolean(session) && (signedIn || alreadyTheirs)
  const screen = welcomeScreen({ settled, signedIn: signedIn || alreadyTheirs, leaving })
  const wait = useDeferredWait(screen === 'wait' && !leaving)

  // Declared in the render that finds the account in hand rather than run from
  // an effect afterwards. An effect lets this screen paint once more first, and
  // the transition carries that paint across as a page being left.
  const exit = leaving ? <Navigate to="/console" replace /> : null

  if (screen === 'wait') {
    return (
      <>
        {exit}
        <Seo
          title="Your Build Is Open"
          description="Open the TaylorURL console for the build you have just paid for."
          path="/welcome"
          noIndex
        />
        <ConsoleShell>
          <Waiting visible={wait.visible} label="Opening your build" />
        </ConsoleShell>
      </>
    )
  }

  const address = buyer?.email
  const passwordHref = address
    ? `/forgot-password?email=${encodeURIComponent(address)}`
    : '/forgot-password'

  return (
    <>
      <Seo
        title="Set a Password"
        description="Set a password on the account holding the build you have paid for."
        path="/welcome"
        noIndex
      />
      <AuthShell
        title="Set a Password"
        blurb={
          address
            ? `Your build is open on ${address}. Set a password on that address and your console opens.`
            : 'Your build is open on the address you paid with. Set a password on that address and your console opens.'
        }
        formName="welcome"
        bought
        business={buyer?.business}
        alternative={{ to: '/login', lead: 'Already have a password?', label: 'Log in' }}
      >
        <Link to={passwordHref} className="auth-submit inline-flex items-center justify-center">
          Set a Password
        </Link>
        <p className="auth-note">
          The next screen sends the link to that address. It works once and expires in an hour.
        </p>
      </AuthShell>
    </>
  )
}
