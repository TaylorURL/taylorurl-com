import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Seo from '@components/Seo'
import { unsubscribeToken } from '@data/newsletter/subscription'
import { faultMessage } from '@utils/faults'
import SubscriptionShell from './SubscriptionShell'
import UnsubscribeForm from './UnsubscribeForm'

// What a request that did not settle says, in front of the way off that stands
// on this page whatever happened. It says the address is still on the list,
// because that is the fact the reader came for and the one they will act on.
const NOT_TAKEN_OFF = 'That address could not be taken off the list just now.'

const COPY = {
  working: {
    eyebrow: 'Unsubscribing',
    heading: 'Taking this address off the list.',
  },
  done: {
    eyebrow: 'Unsubscribed',
    heading: 'You’re off the list.',
    body: 'Nothing more goes to this address. There is nothing else to do.',
  },
  already: {
    eyebrow: 'Unsubscribed',
    heading: 'You’re already off the list.',
    body: 'This address came off the list earlier. There is nothing else to do.',
  },
  missing: {
    eyebrow: 'Unsubscribe',
    heading: 'Take your address off the list.',
    body: 'Enter the address the email arrived at. It comes off every list we send from.',
  },
  invalid: {
    eyebrow: 'Link Refused',
    heading: 'This link doesn’t match an address.',
    body: 'Open the unsubscribe link from the email again, or reply to that email and we will take the address off.',
  },
  failed: {
    eyebrow: 'Link Refused',
    heading: 'This link didn’t work.',
    body: 'Reply to that email and we will take the address off.',
  },
}

/**
 * The page an unsubscribe link opens, and the page a reader reaches without one.
 *
 * Two lists send links here and each arrives having done a different amount of
 * the work. A newsletter link carries `token`, which is the whole credential, so
 * the request goes out on arrival and the page reports what came back. An
 * outreach link goes to api/outreach/unsubscribe first, which retires the
 * prospect and redirects here carrying `state`, so the work is already done and
 * the page only states the outcome.
 *
 * Neither link has a button. A reader who followed an unsubscribe link has
 * already said what they want, and a mail client that prefetches the link finds
 * an address that is off the list either way.
 *
 * A reader arriving with neither is the third way in, and the only one that has
 * to ask for anything: the address itself is what stands in for the link, so
 * the page carries a field for it and settles on the same statement the two
 * links settle on.
 */
export default function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const settled = params.get('state')
  // Working is the state the page is built in, since both the token and the
  // outcome live in a query string a static render never sees. Which one it is
  // is settled on mount, in the browser that opened the link.
  const [state, setState] = useState('working')
  const [failure, setFailure] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    if (settled) {
      setState(COPY[settled] ? settled : 'failed')
      return
    }
    if (!token) {
      setState('missing')
      return
    }

    unsubscribeToken(token)
      .then(({ already }) => setState(already ? 'already' : 'done'))
      .catch(cause => {
        setFailure(faultMessage(cause, NOT_TAKEN_OFF))
        setState('failed')
      })
  }, [settled, token])

  const copy = COPY[state]

  // Why the reason is added to the standing line rather than put in place of
  // it. A reader who followed an unsubscribe link has already decided; the one
  // thing they must never be handed is a reason with no way past it, because an
  // address left on a list by a page that only explained itself is a person who
  // asked to leave and did not. So the sentence about the request is said
  // first, and the way off follows it in the same breath.
  //
  // It stays on the page for the same reason it is not a notice in the corner.
  // This is the whole of what the page has to say, nothing here is a form to
  // press again, and a reader who looks up half a minute later still has to be
  // able to read what happened and what to do about it.
  const body = state === 'failed' && failure ? `${failure} ${copy.body}` : copy.body

  return (
    <>
      <Seo
        title="Unsubscribe"
        description="Take an address off the TaylorURL mailing list."
        path="/unsubscribe"
        noIndex
      />
      <SubscriptionShell eyebrow={copy.eyebrow} heading={copy.heading} body={body}>
        {state === 'missing' && <UnsubscribeForm onDone={() => setState('done')} />}
      </SubscriptionShell>
    </>
  )
}
