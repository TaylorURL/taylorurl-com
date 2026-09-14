import { useState } from 'react'
import { Check } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import Seo from '@components/Seo'
import EnquirySend from '@components/conversion/EnquirySend'
import { useToast } from '@hooks/chrome/useToast'
import { useFormFields } from '@hooks/useFormFields'
import { FIELD_FAULT, FIELD_LABEL, GROUNDS } from '@constants/grounds'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { faultMessage } from '@utils/faults'
import { submitEnquiry } from '@data/leads/sendEnquiry'

const GROUND = GROUNDS.paper

const EMPTY = { name: '', company: '', email: '', website: '', message: '' }

// What this page asks, in the words the notice reads back. The labels below and
// the notice the endpoint sends come from the same set, so rewording a field
// here rewords the inbox with it.
const ASKED = QUESTIONS.start

// The one question the shared set has no row for, because no other form asks
// it. It rides on the message, so the reply is written by somebody who has
// already opened whatever is standing today.
const SITE_ASKED = 'Current website, if there is one'

// What a message that did not leave says. It names the message rather than
// whatever carried it, because somebody who has just written a paragraph wants
// to know whether the paragraph survived.
const NOT_SENT = 'That message did not send. Nothing you typed was lost, so try it again.'

// The reply is written by a person, so the form takes the email and nothing
// else it would need to reach one.
const REPLY_BY = 'email'

/**
 * Everything the message carries, which is what the writer typed plus the
 * address of the site they already have.
 *
 * The website is a separate box on the page because somebody reading a form
 * answers the question in front of them, and it goes out inside the message
 * because that is where a notice has room for it.
 */
function messageFrom(fields) {
  const written = fields.message.trim()
  const site = fields.website.trim()
  return site ? `${written}\n\n${SITE_ASKED}: ${site}` : written
}

/**
 * The page every Start a Project button opens: one screen that asks who is
 * writing, what the business is, and what the site has to do.
 *
 * It posts to the same endpoint the contact page posts to, so one inbox, one
 * set of questions and one attribution answer for both. What separates them is
 * the reader: somebody on /contact is deciding whether to start a conversation
 * and somebody here has decided, so the page is the form and the line above it
 * and nothing else.
 */
export default function Start() {
  const toast = useToast()
  const { fields, setFields, errors, setErrors, change } = useFormFields(EMPTY)
  const [status, setStatus] = useState('idle')

  // The same rules the endpoint applies, so a fault is named under the field
  // rather than arriving as a refusal after the round trip.
  const faultIn = held => {
    if (!hasMinLength(held.name, 2)) return { field: 'name', fault: 'Add your name.' }
    if (!hasMinLength(held.company, 2)) {
      return { field: 'company', fault: 'Add the name the business trades under.' }
    }
    if (!isValidEmail(held.email)) {
      return { field: 'email', fault: 'Check the email address. The reply has nowhere else to go.' }
    }
    if (!hasMinLength(held.message, 10)) {
      return {
        field: 'message',
        fault: 'A sentence about the business is enough to start.',
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
      document.getElementById(found.field)?.focus()
      return
    }

    setErrors({})
    setStatus('submitting')
    try {
      await submitEnquiry({
        form: 'start',
        name: fields.name,
        email: fields.email,
        company: fields.company,
        contactMethod: REPLY_BY,
        message: messageFrom(fields),
      })
      setStatus('sent')
      setFields(EMPTY)
    } catch (cause) {
      // A send that failed is a notice rather than a line in the form. The four
      // faults this form raises itself are each about one field and each sit
      // under it; this one is about none of them.
      setStatus('idle')
      toast(faultMessage(cause, NOT_SENT), 'error')
    }
  }

  return (
    <div>
      <Seo
        title="Start a Project with TaylorURL"
        description="Tell a small Baytown web team what the business does and what the site has to do. You get a reply by email, and a plan and a price for the project."
        path="/start"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Start a Project', path: '/start' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            url: `${SITE_URL}/start`,
            mainEntity: { '@id': BUSINESS_ID },
          },
        ]}
      />
      <PageHero
        eyebrow="Start a Project"
        title="Tell us what you need built."
        description="Write down what the business does and what the site has to do. You get a reply by email with anything we still need to know, then a plan and a price for the project."
      />

      <section {...GROUND.attrs} className={`section-y relative overflow-hidden ${GROUND.section}`}>
        <div className="container-rail relative">
          <div className="panel-static mx-auto max-w-3xl p-8 sm:p-12">
            <div
              className={`mb-8 flex items-baseline justify-between border-b pb-5 ${GROUND.rule}`}
            >
              <h2 className={`text-[19px] font-semibold tracking-tight ${GROUND.title}`}>
                About the Project
              </h2>
              <span className={`section-label-sm ${GROUND.meta}`}>Project Form</span>
            </div>

            {status === 'sent' ? (
              <div className="flex items-center gap-4" role="status">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-accent/50 bg-accent/10">
                  <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
                </div>
                <div>
                  <p className="section-label-sm text-accent">Message Sent</p>
                  <p className={`text-[15px] ${GROUND.title}`}>
                    Thanks. You get the reply by email, usually within the hour.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-7" noValidate>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className={FIELD_LABEL}>
                      {ASKED.name}
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      autoComplete="name"
                      required
                      value={fields.name}
                      onChange={change}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      className="field py-3.5"
                      placeholder="Your name"
                    />
                    {errors.name && (
                      <p id="name-error" className={FIELD_FAULT} role="alert">
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="company" className={FIELD_LABEL}>
                      {ASKED.company}
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      autoComplete="organization"
                      required
                      value={fields.company}
                      onChange={change}
                      aria-invalid={errors.company ? true : undefined}
                      aria-describedby={errors.company ? 'company-error' : undefined}
                      className="field py-3.5"
                      placeholder="What the business is called"
                    />
                    {errors.company && (
                      <p id="company-error" className={FIELD_FAULT} role="alert">
                        {errors.company}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="email" className={FIELD_LABEL}>
                      {ASKED.email}
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      required
                      value={fields.email}
                      onChange={change}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className="field py-3.5"
                      placeholder="you@yourbusiness.com"
                    />
                    {errors.email && (
                      <p id="email-error" className={FIELD_FAULT} role="alert">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="website" className={FIELD_LABEL}>
                      {SITE_ASKED}
                    </label>
                    <input
                      type="text"
                      id="website"
                      name="website"
                      autoComplete="url"
                      value={fields.website}
                      onChange={change}
                      className="field py-3.5"
                      placeholder="yourbusiness.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className={FIELD_LABEL}>
                    {ASKED.message}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    value={fields.message}
                    onChange={change}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    className="field resize-none py-3.5"
                    placeholder="What the business does, who you want walking in, and anything the site has to handle."
                  />
                  {errors.message && (
                    <p id="message-error" className={FIELD_FAULT} role="alert">
                      {errors.message}
                    </p>
                  )}
                </div>

                <div className={`border-t pt-6 ${GROUND.rule}`}>
                  <EnquirySend sending={status === 'submitting'}>
                    Get a Plan and a Price
                  </EnquirySend>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
