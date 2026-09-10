import { useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import ContactMethodChoice from '@components/conversion/ContactMethodChoice'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { submitEnquiry } from '@data/leads/sendEnquiry'
import { GROUND } from './lib/ground'

const LABEL = 'section-label-sm mb-2 block text-paper-faint'
const FAULT = 'mt-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]'
const EMPTY = { name: '', email: '', contactMethod: 'either', phone: '', message: '' }

// What a message that did not leave says. It names the message rather than what
// carried it, and it says the thing worth knowing: the words are still in the
// box, so trying again costs nothing but the press.
const NOT_SENT = 'That message did not send. Try it again in a moment.'

// What a tool's form asks, in the words the notice reports back.
const ASKED = QUESTIONS.tools

/**
 * The inquiry a tool finishes on.
 *
 * What the tool worked out rides on the message rather than being asked for
 * again, so the reply is written by somebody who can already see the findings.
 * The summary above the button is what the message will say, which is the same
 * arrangement the configurator ends on.
 *
 * @param {object} props
 * @param {Array<{ label: string, value: string }>} props.summary - What the
 *   message carries besides the sender's own words.
 * @param {string} props.projectType - Which tool the inquiry came from.
 * @param {string} props.idPrefix - Prefix for the field ids, so a form on one
 *   tool cannot claim the ids of a form on another.
 * @param {string} [props.placeholder] - The prompt in the message field.
 */
export default function ToolEnquiry({ summary, projectType, idPrefix, placeholder }) {
  const toast = useToast()
  const [fields, setFields] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')

  const change = event => {
    const { name, value } = event.target
    setFields(held => ({ ...held, [name]: value }))
    setErrors(current => {
      if (!current[name]) return current
      const rest = { ...current }
      delete rest[name]
      return rest
    })
  }

  // The same rules the endpoint applies, so a fault is named here rather than
  // arriving as a refusal after the round trip.
  const faultIn = held => {
    if (!hasMinLength(held.name, 2)) return { field: 'name', fault: 'Add your name.' }
    if (!isValidEmail(held.email)) {
      return { field: 'email', fault: 'Check the email address. The reply has nowhere else to go.' }
    }
    if (!hasMinLength(held.message, 10)) {
      return {
        field: 'message',
        fault: 'Add a line or two about the work so the reply is worth reading.',
      }
    }
    return null
  }

  const submit = async event => {
    event.preventDefault()
    if (status === 'submitting') return

    const found = faultIn(fields)
    if (found) {
      setErrors({ [found.field]: found.fault })
      document.getElementById(`${idPrefix}-${found.field}`)?.focus()
      return
    }

    setErrors({})
    setStatus('submitting')
    try {
      await submitEnquiry({
        form: 'tools',
        name: fields.name,
        email: fields.email,
        contactMethod: fields.contactMethod,
        phone: fields.phone,
        projectType,
        message: [
          fields.message.trim(),
          '',
          ...summary.map(row => `${row.label}: ${row.value}`),
        ].join('\n'),
      })
      setStatus('sent')
      setFields(EMPTY)
    } catch (cause) {
      // A send that failed is a notice rather than a line in the form. The
      // three faults this form raises itself are each about one field and each
      // sit under it; a line in the same tone at the foot of the form, about
      // none of them, reads as a fourth field having gone wrong.
      setStatus('idle')
      toast(faultMessage(cause, NOT_SENT), 'error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="panel-static flex items-center gap-4 p-6">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-accent/50 bg-accent/10">
          <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="section-label-sm text-accent">Message Sent</p>
          <p className="text-[15px] text-ink-paper">
            Thanks. You usually get a reply within the hour.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-name`} className={LABEL}>
            {ASKED.name}
          </label>
          <input
            type="text"
            id={`${idPrefix}-name`}
            name="name"
            autoComplete="name"
            required
            value={fields.name}
            onChange={change}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
            className="field py-3.5"
            placeholder="Your name"
          />
          {errors.name && (
            <p id={`${idPrefix}-name-error`} className={FAULT} role="alert">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${idPrefix}-email`} className={LABEL}>
            {ASKED.email}
          </label>
          <input
            type="email"
            id={`${idPrefix}-email`}
            name="email"
            autoComplete="email"
            required
            value={fields.email}
            onChange={change}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined}
            className="field py-3.5"
            placeholder="you@yourbusiness.com"
          />
          {errors.email && (
            <p id={`${idPrefix}-email-error`} className={FAULT} role="alert">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-message`} className={LABEL}>
          {ASKED.message}
        </label>
        <textarea
          id={`${idPrefix}-message`}
          name="message"
          required
          rows={5}
          value={fields.message}
          onChange={change}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? `${idPrefix}-message-error` : undefined}
          className="field resize-none py-3.5"
          placeholder={placeholder}
        />
        {errors.message && (
          <p id={`${idPrefix}-message-error`} className={FAULT} role="alert">
            {errors.message}
          </p>
        )}
      </div>

      <ContactMethodChoice
        value={fields.contactMethod}
        phone={fields.phone}
        onChange={change}
        idPrefix={idPrefix}
      />

      {summary.length > 0 && (
        <div className={`border-t pt-6 ${GROUND.rule}`}>
          <p className="section-label-sm text-accent">What the Message Carries</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {summary.map(row => (
              <div key={row.label}>
                <dt className="section-label-sm text-paper-faint">{row.label}</dt>
                <dd className="mt-1 break-words text-[14px] leading-snug text-ink-paper">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className={`border-t pt-6 ${GROUND.rule}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn btn-primary group"
          >
            {status === 'submitting' ? 'Sending…' : 'Get a Plan and a Price'}
            {status !== 'submitting' && (
              <ArrowUpRight
                className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            )}
          </button>
          <p className="section-label-sm text-paper-faint">
            Free, and usually answered within the hour
          </p>
        </div>
      </div>
    </form>
  )
}
