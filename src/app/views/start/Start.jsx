import { useState } from 'react'
import { Check, Phone } from 'lucide-react'
import PageHero from '@components/page-bands/PageHero'
import Seo from '@components/Seo'
import SendButton from '@components/conversion/SendButton'
import ReviewStandingRail from '@components/reviews/ReviewStandingRail'
import { useToast } from '@hooks/chrome/useToast'
import { useFormFields } from '@hooks/useFormFields'
import { FIELD_FAULT, FIELD_LABEL, GROUNDS } from '@constants/grounds'
import { CONTACT_METHODS, DEFAULT_CONTACT_METHOD } from '@constants/navigation'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { faultMessage } from '@utils/faults'
import { submitEnquiry } from '@data/leads/sendEnquiry'
import { PUBLISHES_REVIEWS, SITE } from '../../../../lib/site/current.js'

const GROUND = GROUNDS.paper
const SLAB = GROUNDS.dark

const EMPTY = {
  name: '',
  company: '',
  email: '',
  phone: '',
  contactMethod: DEFAULT_CONTACT_METHOD,
  website: '',
  message: '',
}

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

// What stands under the send button. Each clause answers one reason not to
// press it.
const FINE_PRINT =
  'Free. No account to make, nothing charged until you have a price in writing, and no call unless you ask for one.'

// The four things the hero promises, under the headline, before the form asks
// for anything.
const PROMISES = [
  'Free to ask',
  'Reply usually within the hour',
  'Price in writing before any work',
  'Most sites live in two to four weeks',
]

// What happens after send, beside the form, so pressing it is not a leap into
// nothing.
const NEXT = [
  {
    title: 'Within the hour',
    body: 'A person reads what you wrote and replies with anything we still need to know.',
  },
  {
    title: 'Plan and price',
    body: 'What gets built, how long it takes and what it costs. In writing, before anything is charged.',
  },
  {
    title: 'Build and go live',
    body: 'You see the work as it goes. Most sites are live in two to four weeks.',
  },
]

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
 * The page every Start a Project button opens: how to reach the sender first,
 * then what the site has to do, with the number to call standing beside it.
 *
 * It posts to the same endpoint the contact page posts to, so one inbox, one
 * set of questions and one attribution answer for both. What separates them is
 * the reader: somebody on /contact is deciding whether to start a conversation
 * and somebody here has decided. So the contact fields come before the
 * paragraph, and a form abandoned halfway still holds the part worth having.
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
      return { field: 'company', fault: 'Add the name of the business.' }
    }
    if (!isValidEmail(held.email)) {
      return { field: 'email', fault: 'Check the email address. The reply has nowhere else to go.' }
    }
    if (held.contactMethod === 'phone' && !hasMinLength(held.phone, 7)) {
      return {
        field: 'phone',
        fault: 'A phone number is needed to return a call. Pick email instead to skip it.',
      }
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
        contactMethod: fields.contactMethod,
        phone: fields.phone,
        message: messageFrom(fields),
      })
      setStatus('sent')
      setFields(EMPTY)
    } catch (cause) {
      // A send that failed is a notice rather than a line in the form. The
      // faults this form raises itself are each about one field and each sit
      // under it; this one is about none of them.
      setStatus('idle')
      toast(faultMessage(cause, NOT_SENT), 'error')
    }
  }

  return (
    <div>
      <Seo
        title="Start Your Small Business Website Project"
        description="Tell us what the site has to do and how to reach you. A small Baytown web team reads it and replies, usually within the hour, with a plan and a price in writing."
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
        title="Tell us what the site has to do. You get a plan and a price back, in writing."
        description="Two minutes to fill in. A person in Baytown reads it and usually replies within the hour, by email or with a call, whichever you pick. Nothing is charged to find out what it costs."
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {PROMISES.map(promise => (
            <li
              key={promise}
              className="flex items-center gap-2.5 text-[14px] font-medium text-ink-soft"
            >
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
              {promise}
            </li>
          ))}
        </ul>
        {/* The number, where a thumb is already resting on it. Wider screens
            carry it beside the form instead. */}
        <div className="mt-8 flex flex-col gap-3 lg:hidden">
          <a href={SITE.phoneHref} className="btn btn-secondary w-full">
            <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Call {SITE.phone}
          </a>
          <p className="text-center text-[13px] text-ink-faint">or fill in the form below</p>
        </div>
      </PageHero>

      <section {...GROUND.attrs} className={`section-y relative overflow-hidden ${GROUND.section}`}>
        <div className="container-rail relative">
          {/* The column is pinned to the rail's width at every size, because the
                review rail in the aside would otherwise hand the grid an intrinsic
                width wider than a phone and push the form off the right edge. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="panel-static min-w-0 p-6 sm:p-10">
              <div
                className={`mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-5 ${GROUND.rule}`}
              >
                <div>
                  <h2 className={`text-[20px] font-semibold tracking-tight ${GROUND.title}`}>
                    Tell us about the business
                  </h2>
                  <p className={`mt-1.5 text-[14px] ${GROUND.body}`}>
                    Five short answers. The person who reads them writes the reply.
                  </p>
                </div>
                <span className={`section-label-sm ${GROUND.meta}`}>About 2 Min</span>
              </div>

              {status === 'sent' ? (
                <div className="flex items-center gap-4" role="status">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-accent/50 bg-accent/10">
                    <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="section-label-sm text-accent">Message Sent</p>
                    <p className={`text-[15px] ${GROUND.title}`}>
                      Thanks. A person reads it and gets back to you, usually within the hour.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-8" noValidate>
                  <fieldset className="space-y-5">
                    <legend className="mb-5 flex items-center gap-3">
                      <StepMark>1</StepMark>
                      <span className={`text-[16px] font-semibold tracking-tight ${GROUND.title}`}>
                        How to reach you
                      </span>
                    </legend>

                    <div className="grid gap-5 sm:grid-cols-2">
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

                    <div className="grid gap-5 sm:grid-cols-2">
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
                          aria-describedby={errors.email ? 'email-error' : 'email-note'}
                          className="field py-3.5"
                          placeholder="you@yourbusiness.com"
                        />
                        {errors.email ? (
                          <p id="email-error" className={FIELD_FAULT} role="alert">
                            {errors.email}
                          </p>
                        ) : (
                          <p id="email-note" className={`mt-2 text-[13px] ${GROUND.meta}`}>
                            Where we send the plan and the price.
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="phone" className={FIELD_LABEL}>
                          {ASKED.phone}
                        </label>
                        <div className="relative">
                          <Phone
                            aria-hidden="true"
                            strokeWidth={1.5}
                            className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${GROUND.meta}`}
                          />
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            autoComplete="tel"
                            value={fields.phone}
                            onChange={change}
                            aria-invalid={errors.phone ? true : undefined}
                            aria-describedby={errors.phone ? 'phone-error' : 'phone-note'}
                            className="field py-3.5 pl-10"
                            placeholder="(281) 555-0100"
                          />
                        </div>
                        {errors.phone ? (
                          <p id="phone-error" className={FIELD_FAULT} role="alert">
                            {errors.phone}
                          </p>
                        ) : (
                          <p id="phone-note" className={`mt-2 text-[13px] ${GROUND.meta}`}>
                            Optional. It only rings if you ask for a call.
                          </p>
                        )}
                      </div>
                    </div>

                    <fieldset>
                      <legend className={FIELD_LABEL}>{ASKED.contactMethod}</legend>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {CONTACT_METHODS.map(method => (
                          <label key={method.value} className="relative block cursor-pointer">
                            <input
                              type="radio"
                              name="contactMethod"
                              value={method.value}
                              checked={fields.contactMethod === method.value}
                              onChange={change}
                              className="sr-only"
                            />
                            <span className="choice-tile">{method.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </fieldset>

                  <fieldset className="space-y-5">
                    <legend className="mb-5 flex items-center gap-3">
                      <StepMark>2</StepMark>
                      <span className={`text-[16px] font-semibold tracking-tight ${GROUND.title}`}>
                        What the site has to do
                      </span>
                    </legend>

                    <div>
                      <label htmlFor="message" className={FIELD_LABEL}>
                        {ASKED.message}
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={4}
                        value={fields.message}
                        onChange={change}
                        aria-invalid={errors.message ? true : undefined}
                        aria-describedby={errors.message ? 'message-error' : undefined}
                        className="field resize-none py-3.5"
                        placeholder="What the business does, who you want walking in, and anything the site has to handle. A sentence is enough to start."
                      />
                      {errors.message && (
                        <p id="message-error" className={FIELD_FAULT} role="alert">
                          {errors.message}
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
                        aria-describedby="website-note"
                        className="field py-3.5"
                        placeholder="yourbusiness.com"
                      />
                      <p id="website-note" className={`mt-2 text-[13px] ${GROUND.meta}`}>
                        Optional. We open it before we reply.
                      </p>
                    </div>
                  </fieldset>

                  <div className={`border-t pt-7 ${GROUND.rule}`}>
                    <div className="[&>button]:w-full">
                      <SendButton sending={status === 'submitting'}>
                        Get My Plan and Price
                      </SendButton>
                    </div>
                    <p className={`mt-4 text-center text-[13px] leading-relaxed ${GROUND.body}`}>
                      {FINE_PRINT}
                    </p>
                  </div>
                </form>
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-28">
              {/* The other way in. A reader who would rather talk converts
                  without touching the form. Narrow screens carry the same
                  number in the hero, above the form, so the card stands down
                  there rather than saying it twice. */}
              <div
                {...SLAB.attrs}
                className={`hidden rounded-[var(--r-card)] p-7 lg:block ${SLAB.section}`}
              >
                <p className="section-label-sm text-accent">Rather Talk?</p>
                <a
                  href={SITE.phoneHref}
                  className="mt-3 block text-[30px] font-semibold tracking-tightest text-ink transition-colors hover:text-accent"
                >
                  {SITE.phone}
                </a>
                <p className={`mt-3 text-[14px] leading-relaxed ${SLAB.body}`}>
                  A small team builds it and answers the phone. Say what the business does and you
                  get the same plan and price over the phone.
                </p>
                <a href={SITE.phoneHref} className="btn btn-secondary mt-5 w-full">
                  Call Now
                </a>
              </div>

              <div className={`${GROUND.shell} p-7`}>
                <p className={`section-label-sm ${GROUND.meta}`}>What Happens Next</p>
                <ol className="mt-5 space-y-5">
                  {NEXT.map((step, index) => (
                    <li key={step.title} className="flex gap-3.5">
                      <StepMark>{index + 1}</StepMark>
                      <div>
                        <p className={`text-[15px] font-semibold tracking-tight ${GROUND.title}`}>
                          {step.title}
                        </p>
                        <p className={`mt-1 text-[13px] leading-relaxed ${GROUND.body}`}>
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {PUBLISHES_REVIEWS && (
                <div className={`${GROUND.shell} p-5`}>
                  <ReviewStandingRail />
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}

/** The numbered mark a step in the form or in the sidebar is counted with. */
function StepMark({ children }) {
  return (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold text-accent"
      aria-hidden="true"
    >
      {children}
    </span>
  )
}
