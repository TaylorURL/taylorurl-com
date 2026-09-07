import { useId, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { unsubscribeAddress } from '@data/newsletter/subscription'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { isValidEmail } from '@utils/validation'

// What a request that did not settle says. The address is still on the list and
// the box still holds it, so the only thing left to do is press the button
// again, and the sentence says so rather than leaving it to be guessed.
const NOT_TAKEN_OFF = 'That address could not be taken off the list. Try it again in a moment.'

/**
 * The way off the list for a reader whose link is not in front of them.
 *
 * An unsubscribe link is one line in a message that may have been forwarded,
 * quoted into a reply, or opened in a client that strips it, so the address
 * itself is the second way of naming the same thing. Typing it does the same
 * work the link does and reports the same outcome, which is why success is
 * handed back to the page rather than shown here: there is one statement about
 * an address being off the list and both routes reach it.
 *
 * The address is measured before the request for the same reason every other
 * form on the site measures it — a typo is answered under the field rather than
 * costing a round trip to be told the same thing.
 *
 * @param {object} props
 * @param {() => void} props.onDone - Called once the address is off.
 */
export default function UnsubscribeForm({ onDone }) {
  const toast = useToast()
  const fieldId = useId()
  const faultId = `${fieldId}-fault`
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [fault, setFault] = useState(null)

  const handleSubmit = async event => {
    event.preventDefault()
    if (status === 'submitting') return

    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setFault('Enter a valid email address.')
      return
    }

    setFault(null)
    setStatus('submitting')

    try {
      await unsubscribeAddress(trimmed)
      onDone()
    } catch (cause) {
      // The line under the field is for the one thing this form judges, and
      // that is the address. A request that did not settle is about the address
      // being sent rather than the address being wrong, and a sentence about a
      // dropped connection sitting where "Enter a valid email address." sits,
      // with the field marked invalid beside it, sends the reader off to
      // correct something that is already right.
      setStatus('idle')
      toast(faultMessage(cause, NOT_TAKEN_OFF), 'error')
    }
  }

  return (
    // The card stands on the page's own paper rather than a pinned white sheet,
    // which is reserved for a surface that has to stay white whatever the
    // setting. Every role inside it is named against paper for the same reason:
    // the section behind is a dark slab, and a role read off the section would
    // put white ink on the card.
    <div className="panel-static mt-9 max-w-xl bg-paper p-6 sm:p-8">
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor={fieldId} className="section-label-sm text-paper-faint mb-2 block">
          Email address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={fieldId}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            disabled={status === 'submitting'}
            onChange={event => setEmail(event.target.value)}
            aria-invalid={fault ? 'true' : undefined}
            aria-describedby={fault ? faultId : undefined}
            className="field flex-1 py-3.5"
            placeholder="you@yourbusiness.com"
          />
          <button type="submit" disabled={status === 'submitting'} className="btn btn-primary">
            {status === 'submitting' ? 'Unsubscribing' : 'Unsubscribe'}
          </button>
        </div>
        {/* A fault is a sentence rather than a standing label, so it is set as
            small prose and carries a mark of its own: red alone says nothing to
            a reader who cannot see it. */}
        {fault && (
          <p
            id={faultId}
            role="alert"
            className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]"
          >
            <AlertCircle
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{fault}</span>
          </p>
        )}
      </form>
    </div>
  )
}
