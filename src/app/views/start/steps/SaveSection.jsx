import { useState } from 'react'
import { Check } from 'lucide-react'
import EnquirySend from '@components/conversion/EnquirySend'
import { useFormFields } from '@hooks/useFormFields'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { submitEnquiry, enquiryErrorMessage } from '@data/leads/sendEnquiry'
import { FIELD_FAULT, FIELD_LABEL, GROUND, PANEL_EYEBROW, PANEL_TITLE } from '../lib/ground'

const EMPTY = { name: '', email: '' }

// What the configurator's own form asks, in the words the notice reports back.
const ASKED = QUESTIONS.start

/**
 * The way out of the configurator that is not a card.
 *
 * The steps ask five questions before they ask for a payment, and every answer
 * lived in the browser until the payment carried them. Somebody who answered
 * four of them and closed the tab was somebody the studio never knew had been
 * here - the most interested visitor the site gets, and the one it recorded
 * nothing about.
 *
 * So the answers can be sent as they stand. The brief travels as the message,
 * which is why the form asks for two things rather than restating questions
 * the controls above have already answered: the configuration is the enquiry,
 * and the name and the address are only what a reply needs.
 *
 * It stands beside the steps rather than inside one, because it is not a
 * question in the sequence. A visitor who means to pay walks past it; a visitor
 * who does not has somewhere to go that is not the back button.
 *
 * @param {object} props
 * @param {Array<{ label: string, value: string }>} props.summary - The
 *   configuration as it stands, which is what the message carries.
 * @param {string} [props.tradeName] - The trade the steps were written for,
 *   filed against the enquiry so the inbox can sort by it.
 * @param {string} [props.email] - The address given on the first step, which is
 *   the address a reply would go to. It is filled in rather than asked for
 *   again, so the form is one field long for somebody who has already answered
 *   it. The panel only ever stands on a step that address opened.
 */
export default function SaveSection({ summary, tradeName = '', email = '' }) {
  const { fields, setFields, errors, setErrors, change } = useFormFields(() => ({
    ...EMPTY,
    email,
  }))
  const [fault, setFault] = useState(null)
  const [status, setStatus] = useState('idle')

  // The same two rules the endpoint applies to what this form collects. The
  // message is not among them: it is composed from the configuration, so it is
  // never short and never the sender's problem.
  const faultIn = held => {
    if (!hasMinLength(held.name, 2)) return { field: 'name', fault: 'Add your name.' }
    if (!isValidEmail(held.email)) {
      return { field: 'email', fault: 'Check the address. The reply has nowhere else to go.' }
    }
    return null
  }

  const submit = async event => {
    event.preventDefault()
    if (status === 'submitting') return

    const found = faultIn(fields)
    if (found) {
      setErrors({ [found.field]: found.fault })
      document.getElementById(`start-save-${found.field}`)?.focus()
      return
    }

    setErrors({})
    setFault(null)
    setStatus('submitting')
    try {
      await submitEnquiry({
        form: 'start',
        name: fields.name,
        email: fields.email,
        projectType: tradeName,
        // The configuration is the message. There is no box to type in,
        // because the five screens above have already asked everything a first
        // reply needs and a blank textarea at this point is one more thing to
        // do before a person who is not ready to pay can say so.
        message: summary.map(row => `${row.label}: ${row.value}`).join('\n'),
      })
      setStatus('sent')
      setFields({ ...EMPTY, email })
    } catch (error) {
      setStatus('idle')
      setFault(enquiryErrorMessage(error))
    }
  }

  return (
    <div className={`mt-14 p-8 sm:p-12 ${GROUND.shell}`}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <p className={PANEL_EYEBROW}>No Card Needed</p>
          <h2 className={PANEL_TITLE}>Send us what you have so far.</h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-paper-soft">
            Everything you have picked comes with it. We read it, write back with a plan and a
            price, and nothing is charged to find out what the work costs.
          </p>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-paper-soft">
            You can keep going through the steps either way. This does not close them.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="panel-static flex items-center gap-4 self-start p-6" role="status">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-accent/50 bg-accent/10">
              <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <p className="section-label-sm text-accent">Brief Sent</p>
              <p className="text-[15px] text-ink-paper">
                Thanks. You usually get a reply within the hour.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="start-save-name" className={FIELD_LABEL}>
                  {ASKED.name}
                </label>
                <input
                  type="text"
                  id="start-save-name"
                  name="name"
                  autoComplete="name"
                  required
                  value={fields.name}
                  onChange={change}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'start-save-name-fault' : undefined}
                  className="field py-3.5"
                  placeholder="Your name"
                />
                {errors.name && (
                  <p id="start-save-name-fault" className={FIELD_FAULT} role="alert">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="start-save-email" className={FIELD_LABEL}>
                  {ASKED.email}
                </label>
                <input
                  type="email"
                  id="start-save-email"
                  name="email"
                  autoComplete="email"
                  required
                  value={fields.email}
                  onChange={change}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? 'start-save-email-fault' : undefined}
                  className="field py-3.5"
                  placeholder="you@yourbusiness.com"
                />
                {errors.email && (
                  <p id="start-save-email-fault" className={FIELD_FAULT} role="alert">
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className={`border-t pt-6 ${GROUND.rule}`}>
              <EnquirySend sending={status === 'submitting'}>Send My Answers</EnquirySend>
              {fault && (
                <p className={FIELD_FAULT} role="alert">
                  {fault}
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
