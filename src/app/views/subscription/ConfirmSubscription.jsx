import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Seo from '@components/Seo'
import { confirmSubscription } from '@data/newsletter/subscription'
import { faultMessage } from '@utils/faults'
import SubscriptionShell from './SubscriptionShell'

// What a request that did not settle says, in front of the way on that stands
// on this page whatever happened. It names the address rather than the link,
// because a reader who has clicked the link twice needs to know which of the
// two is still outstanding.
const NOT_CONFIRMED = 'That address could not be confirmed just now.'

const COPY = {
  working: {
    eyebrow: 'Confirming',
    heading: 'Confirming this address.',
  },
  done: {
    eyebrow: 'Subscribed',
    heading: 'You’re on the list.',
    body: 'Short notes on getting found on Google and turning visitors into paying customers. The next one arrives when there’s something worth saying.',
  },
  already: {
    eyebrow: 'Subscribed',
    heading: 'You’re already on the list.',
    body: 'This address is confirmed. The next note arrives when there’s something worth saying.',
  },
  missing: {
    eyebrow: 'Link Incomplete',
    heading: 'Part of this link is missing.',
    body: 'Open the confirmation link from the email again.',
  },
  failed: {
    eyebrow: 'Link Refused',
    heading: 'This link didn’t work.',
    body: 'Open the link in the newest email, or reply to that email and I will confirm the address.',
  },
}

/**
 * The page a confirmation link opens, and the point at which a signup becomes a
 * subscription.
 *
 * The token in the query string is the whole credential, so the request goes
 * out on arrival and the page reports what came back.
 */
export default function ConfirmSubscription() {
  const [params] = useSearchParams()
  const token = params.get('token')
  // Working is the state the page is built in, since the token lives in a query
  // string a static render never sees. What the token turns out to be is
  // settled on mount, in the browser that opened the link.
  const [state, setState] = useState('working')
  const [failure, setFailure] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    if (!token) {
      setState('missing')
      return
    }

    confirmSubscription(token)
      .then(({ already }) => setState(already ? 'already' : 'done'))
      .catch(cause => {
        setFailure(faultMessage(cause, NOT_CONFIRMED))
        setState('failed')
      })
  }, [token])

  const copy = COPY[state]

  // The reason is added to the standing line rather than put in place of it.
  // What went wrong is worth a sentence, but on its own it leaves a reader
  // holding a dead link and no second route, and the page has nothing else on
  // it to press. It stays here rather than in a notice in the corner for the
  // same reason: this is the whole of what the page has to say, and it has to
  // still be there when the reader looks back at it.
  const body = state === 'failed' && failure ? `${failure} ${copy.body}` : copy.body

  return (
    <>
      <Seo
        title="Confirm Your Subscription"
        description="Confirm an address for the TaylorURL newsletter."
        path="/subscribe/confirm"
        noIndex
      />
      <SubscriptionShell eyebrow={copy.eyebrow} heading={copy.heading} body={body} />
    </>
  )
}
