import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Seo from '@components/Seo'
import { confirmSubscription, subscriptionErrorMessage } from '@data/subscription'
import SubscriptionShell from './subscription/SubscriptionShell'

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
      .catch(error => {
        setFailure(subscriptionErrorMessage(error))
        setState('failed')
      })
  }, [token])

  const copy = COPY[state]

  return (
    <>
      <Seo
        title="Confirm Your Subscription"
        description="Confirm an address for the TaylorURL newsletter."
        path="/subscribe/confirm"
        noIndex
      />
      <SubscriptionShell
        eyebrow={copy.eyebrow}
        heading={copy.heading}
        body={state === 'failed' ? failure : copy.body}
      />
    </>
  )
}
