import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import Seo from '@components/Seo'
import SendButton from '@components/conversion/SendButton'
import { Container, Kicker, Square } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import { useToast } from '@hooks/chrome/useToast'
import { useFormFields } from '@hooks/useFormFields'
import { FIELD_FAULT, FIELD_LABEL } from '@constants/grounds'
import { CONTACT_METHODS, DEFAULT_CONTACT_METHOD } from '@constants/navigation'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { START_ADD_ONS, START_SERVICES } from '@data/pages/services'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { BIO_NAME } from '@lib/mail/bio.js'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { faultMessage } from '@utils/faults'
import { retryable } from '@utils/retryImage'
import { submitEnquiry } from '@data/leads/sendEnquiry'
import { SITE } from '../../../../lib/site/current.js'

const EMPTY = {
  name: '',
  company: '',
  email: '',
  phone: '',
  contactMethod: DEFAULT_CONTACT_METHOD,
  service: '',
  website: '',
  message: '',
}

// The questions this form asks, read from the set the notice in the inbox
// reports them under, so the two cannot be worded differently.
const ASKED = QUESTIONS.start

// The one question outside that set: the site somebody already has. It has no
// field of its own in the notice and rides inside the message instead.
const SITE_ASKED = 'Current website, if there is one'

const NOT_SENT = 'Your message did not send. Everything you typed is still here, so try again.'

const FINE_PRINT =
  'No account needed. You pay nothing until you have a written price, and I only call if you ask me to.'

const NEXT = [
  'I read it and reply with any questions.',
  'You get a written plan and price.',
  'Most sites go live in two to four weeks.',
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

/** What sits under a field: the fault when it was refused, otherwise its note. */
function Hint({ id, note, error }) {
  if (error) {
    return (
      <p id={`${id}-error`} className={FIELD_FAULT} role="alert">
        {error}
      </p>
    )
  }
  if (!note) return null
  return (
    <p id={`${id}-note`} className="mt-2 text-[14px] text-ink-mute">
      {note}
    </p>
  )
}

/**
 * The page every Get a price button opens.
 *
 * Five boxes are showing: name, business, email, phone and what the project
 * has to do. Those are what a reply needs. Everything else the old form asked
 * up front - which service, which extras, how to reply, the current site - is
 * still here, folded under "Add more detail", because 532 people opened the
 * long version in ninety days and four sent it.
 *
 * It posts to the same endpoint the contact page posts to, so one inbox, one
 * set of questions and one attribution answer for both.
 */
export default function Start() {
  const toast = useToast()
  const { fields, setFields, errors, setErrors, change } = useFormFields(EMPTY)
  const [status, setStatus] = useState('idle')
  const [addOns, setAddOns] = useState([])

  const toggleAddOn = name =>
    setAddOns(held =>
      held.includes(name) ? held.filter(picked => picked !== name) : [...held, name]
    )

  const faultIn = held => {
    if (!hasMinLength(held.name, 2)) return { field: 'name', fault: 'Add your name.' }
    if (!hasMinLength(held.company, 2)) {
      return { field: 'company', fault: 'Add the name of the business.' }
    }
    if (!isValidEmail(held.email)) {
      return { field: 'email', fault: 'Check the email address. That is where I send the reply.' }
    }
    if (held.contactMethod === 'phone' && !hasMinLength(held.phone, 7)) {
      return {
        field: 'phone',
        fault: 'I need a phone number to call you. Pick email if you would rather skip it.',
      }
    }
    if (!hasMinLength(held.message, 10)) {
      return {
        field: 'message',
        fault: 'Write at least a sentence about the project.',
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
        projectType: fields.service,
        addOns: addOns.join(', '),
        message: messageFrom(fields),
      })
      setStatus('sent')
      setFields(EMPTY)
      setAddOns([])
    } catch (cause) {
      setStatus('idle')
      toast(faultMessage(cause, NOT_SENT), 'error')
    }
  }

  const described = (field, note) => (errors[field] ? `${field}-error` : note && `${field}-note`)

  return (
    <div>
      <Seo
        title="Start a Website, App or Software Project"
        description="Tell me what you need built: a website, an app, or software. I reply within an hour in most cases, and you get a written plan and price before you pay anything."
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

      <section className="signal-grid pb-16 pt-12 text-[color:var(--light)] sm:pb-24 sm:pt-20">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,35rem)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
          <div>
            <Kicker tone="night" className="mb-6 sm:mb-8">
              Get a price
            </Kicker>
            <h1 className={TYPE.display}>
              Tell me what you need
              <Square />
            </h1>
            <p className={`${TYPE.lead} mt-7 max-w-[28rem] text-[color:var(--light-soft)]`}>
              I reply with a written plan and price, usually within the hour. Asking is free.
            </p>
          </div>

          <div className="min-w-0 bg-[var(--paper)] p-6 text-ink sm:p-10 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {status === 'sent' ? (
              <div className="flex items-start gap-4 py-4" role="status">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--signal)] text-white">
                  <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </span>
                <div>
                  <p className={TYPE.h3}>Sent. Thank you.</p>
                  <p className={`${TYPE.body} mt-1`}>
                    I will get back to you within an hour in most cases.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5" noValidate>
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
                      aria-describedby={described('name')}
                      className="field"
                      placeholder="Your name"
                    />
                    <Hint id="name" error={errors.name} />
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
                      aria-describedby={described('company')}
                      className="field"
                      placeholder="What the business is called"
                    />
                    <Hint id="company" error={errors.company} />
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
                      aria-describedby={described('email', true)}
                      className="field"
                      placeholder="you@yourbusiness.com"
                    />
                    <Hint id="email" note="I send the plan and price here." error={errors.email} />
                  </div>
                  <div>
                    <label htmlFor="phone" className={FIELD_LABEL}>
                      {ASKED.phone}
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      value={fields.phone}
                      onChange={change}
                      aria-invalid={errors.phone ? true : undefined}
                      aria-describedby={described('phone', true)}
                      className="field"
                      placeholder="(281) 555-0100"
                    />
                    <Hint id="phone" note="Optional." error={errors.phone} />
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
                    rows={4}
                    value={fields.message}
                    onChange={change}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={described('message')}
                    className="field resize-none py-3"
                    placeholder="What the business does and what the site has to do. A sentence is enough."
                  />
                  <Hint id="message" error={errors.message} />
                </div>

                {/* The rest of what the old form asked, a tap away. Nothing in
                    here is required, so a reader who never opens it loses
                    nothing by sending. */}
                <details className="group border border-[var(--line)] bg-white">
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-4 font-mono text-[13px] font-medium uppercase tracking-[0.07em] text-[color:var(--signal)] [&::-webkit-details-marker]:hidden">
                    <Plus
                      className="h-4 w-4 transition-transform duration-150 group-open:rotate-45"
                      aria-hidden="true"
                    />
                    Add more detail (optional)
                  </summary>
                  <div className="space-y-6 border-t border-[var(--line)] px-4 pb-5 pt-5">
                    <fieldset>
                      <legend className={FIELD_LABEL}>{ASKED.projectType}</legend>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {START_SERVICES.map((service, index) => (
                          <label key={service.slug} className="relative block cursor-pointer">
                            <input
                              type="radio"
                              id={index === 0 ? 'service' : undefined}
                              name="service"
                              value={service.name}
                              checked={fields.service === service.name}
                              onChange={change}
                              className="sr-only"
                            />
                            <span className="choice-tile text-center">{service.name}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {START_ADD_ONS.length > 0 && (
                      <fieldset>
                        <legend className={FIELD_LABEL}>{ASKED.addOns}</legend>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {START_ADD_ONS.map(service => (
                            <label key={service.slug} className="relative block cursor-pointer">
                              <input
                                type="checkbox"
                                name="addOns"
                                value={service.name}
                                checked={addOns.includes(service.name)}
                                onChange={() => toggleAddOn(service.name)}
                                className="sr-only"
                              />
                              <span className="choice-tile text-center">{service.name}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}

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
                        className="field"
                        placeholder="yourbusiness.com"
                      />
                      <Hint id="website" note="I look at it before I reply." />
                    </div>

                    <fieldset>
                      <legend className={FIELD_LABEL}>{ASKED.contactMethod}</legend>
                      <div className="grid gap-2.5 sm:grid-cols-3">
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
                  </div>
                </details>

                <div className="pt-1 [&>button]:w-full">
                  <SendButton sending={status === 'submitting'}>Get my plan and price</SendButton>
                </div>
                <p className="text-[14px] leading-relaxed text-ink-mute">{FINE_PRINT}</p>
              </form>
            )}
          </div>

          <div className="space-y-8">
            <a
              href={SITE.phoneHref}
              data-call-place="start"
              className="group flex items-center gap-5 border-t border-[var(--night-line)] pt-7"
            >
              {/* The photo is of two people, so the frame is cut to the one
                  answering the phone. */}
              <img
                src="/images/trenton-taylor-photo-360.webp"
                alt=""
                width="64"
                height="64"
                loading="lazy"
                decoding="async"
                className="h-16 w-16 shrink-0 object-cover object-[64%_30%]"
                {...retryable()}
              />
              <span>
                <Kicker tone="night" as="span" className="block">
                  Rather talk? Call or text {BIO_NAME.split(' ')[0]}
                </Kicker>
                <span className="mt-2 block font-mono text-[30px] font-medium tracking-[-0.03em] text-[color:var(--light)] group-hover:text-[color:var(--signal)] sm:text-[36px]">
                  {SITE.phone}
                </span>
              </span>
            </a>

            <ol className="space-y-2.5">
              {NEXT.map((step, index) => (
                <li key={step}>
                  <Kicker tone="night" as="span">
                    {String(index + 1).padStart(2, '0')}&nbsp;&nbsp;{step}
                  </Kicker>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>
    </div>
  )
}
