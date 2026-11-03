import { useState } from 'react'
import { Check } from 'lucide-react'
import ContactMethodChoice from '@components/conversion/ContactMethodChoice'
import EnquirySend from '@components/conversion/EnquirySend'
import { CARD, TYPE } from '@components/kit/styles'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { useToast } from '@hooks/chrome/useToast'
import { useFormFields } from '@hooks/useFormFields'
import { faultMessage } from '@utils/faults'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { submitEnquiry } from '@data/leads/sendEnquiry'
import { FIELD_FAULT, FIELD_LABEL } from '@constants/grounds'

const EMPTY = { name: '', email: '', contactMethod: 'either', phone: '', message: '' }

// What a message that did not leave says. It names the message rather than what
// carried it, and it says the thing worth knowing: the words are still in the
// box, so trying again costs nothing but the press.
const NOT_SENT = 'That message did not send. Try it again in a moment.'

// What a tool's form asks, in the words the notice reports back.
const ASKED = QUESTIONS.tools

/**
 * The inquiry a tool finishes on, in a card of its own the way the Start
 * page's form is.
 *
 * What the tool worked out rides on the message rather than being asked for
 * again, so the reply is written by somebody who can already see the findings.
 * The summary above the button is what the message will say, so nothing leaves
 * the page that the sender has not read.
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
  const { fields, setFields, errors, setErrors, change } = useFormFields(EMPTY)
  const [status, setStatus] = useState('idle')

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
      <div className={`${CARD} flex items-start gap-4 p-6 sm:p-8`} role="status">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(74,222,128,0.14)] text-[color:var(--live)]">
          <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div>
          <p className={TYPE.h3}>Sent. Thank you.</p>
          <p className={`${TYPE.body} mt-1`}>
            I will get back to you within an hour in most cases.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${CARD} p-6 sm:p-8`}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-name`} className={FIELD_LABEL}>
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
              className="field"
              placeholder="Your name"
            />
            {errors.name && (
              <p id={`${idPrefix}-name-error`} className={FIELD_FAULT} role="alert">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${idPrefix}-email`} className={FIELD_LABEL}>
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
              className="field"
              placeholder="you@yourbusiness.com"
            />
            {errors.email && (
              <p id={`${idPrefix}-email-error`} className={FIELD_FAULT} role="alert">
                {errors.email}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-message`} className={FIELD_LABEL}>
            {ASKED.message}
          </label>
          <textarea
            id={`${idPrefix}-message`}
            name="message"
            required
            rows={4}
            value={fields.message}
            onChange={change}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? `${idPrefix}-message-error` : undefined}
            className="field resize-none py-3"
            placeholder={placeholder}
          />
          {errors.message && (
            <p id={`${idPrefix}-message-error`} className={FIELD_FAULT} role="alert">
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
          <div className="rounded-[12px] bg-[var(--card-hi)] px-4 py-4 sm:px-5">
            <p className={TYPE.label}>What the message carries</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {summary.map(row => (
                <div key={row.label}>
                  <dt className={TYPE.small}>{row.label}</dt>
                  <dd className="mt-0.5 break-words text-[15px] leading-snug text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="pt-1">
          <EnquirySend sending={status === 'submitting'}>Get a Plan and a Price</EnquirySend>
        </div>
      </form>
    </div>
  )
}
