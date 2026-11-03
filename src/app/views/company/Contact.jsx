import { useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import Seo from '@components/Seo'
import SendButton from '@components/conversion/SendButton'
import ContactMethodChoice from '@components/conversion/ContactMethodChoice'
import { Container } from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import { useToast } from '@hooks/chrome/useToast'
import {
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  DEFAULT_CONTACT_METHOD,
  SALES_EMAIL,
} from '@constants/navigation'
import { FIELD_FAULT, FIELD_LABEL } from '@constants/grounds'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { BIO_NAME } from '@lib/mail/bio.js'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { faultMessage } from '@utils/faults'
import { retryable } from '@utils/retryImage'
import { CONTACT } from '@data/pages/contact'
import { submitEnquiry } from '@data/leads/sendEnquiry'

const REQUIRED_FIELDS = ['name', 'email', 'phone', 'message']

const BLANK = {
  name: '',
  email: '',
  company: '',
  projectType: '',
  contactMethod: DEFAULT_CONTACT_METHOD,
  phone: '',
  message: '',
}

// What a message that did not leave says.
//
// The box is often a paragraph the writer has spent a minute on, so what they
// need told first is that it is still in front of them: a send that failed
// clears nothing, and the fear that it did is what makes somebody close the tab
// rather than press again.
const NOT_SENT = 'That message did not send. Nothing you typed was lost, so try it again.'

// What this form asks, written once and read by both sides: the labels below
// and the notice the endpoint sends come from the same words, so rewording a
// field here rewords the inbox with it.
const ASKED = QUESTIONS.contact

// The reply-method fields are rendered by a shared component that prefixes its
// ids, so the field a fault belongs to is not always named after it.
const FIELD_IDS = { phone: 'contact-phone' }

// The fields folded under "Add More Detail". A fault in one of them opens the
// fold before the field is focused, or the focus lands on something hidden.
const FOLDED = ['phone']

/**
 * The face beside the number and over the byline. The photo is of two people,
 * so the circle is cut to the one answering.
 */
function Face({ size = 52 }) {
  return (
    <img
      src="/images/trenton-taylor-photo-360.webp"
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover object-[64%_30%]"
      {...retryable()}
    />
  )
}

/** The fault under a field, when it was refused. */
function Fault({ id, error }) {
  if (!error) return null
  return (
    <p id={`${id}-error`} className={FIELD_FAULT} role="alert">
      {error}
    </p>
  )
}

/**
 * The contact page, laid out the way the Start page is: what to expect on the
 * left with the number under it, and the form in a card on the right.
 *
 * Three boxes are showing - a name, an address and a sentence - because those
 * are all the endpoint needs to answer. The business name, what is needed and
 * how to reply are still asked, folded under "Add More Detail", so a reader who
 * never opens it loses nothing by sending.
 *
 * The second site mounts this same view as its enquiry form, and every
 * sentence on it comes from `@data/pages/contact`, which hands each site its
 * own copy.
 */
export default function Contact() {
  const toast = useToast()
  const [formData, setFormData] = useState(BLANK)
  const folded = useRef(null)

  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')

  // Checked per field so a blur can ask about one without raising the others,
  // and so the submit can ask about all of them with the same rules.
  const faultIn = (field, values) => {
    if (field === 'name' && !hasMinLength(values.name, 2)) {
      return 'I need a name to put on the reply.'
    }
    if (field === 'email' && !isValidEmail(values.email)) {
      return 'The reply goes to this address, so check it reads right.'
    }
    if (field === 'message' && !hasMinLength(values.message, 10)) {
      return CONTACT.form.shortMessage
    }
    if (field === 'phone' && values.contactMethod === 'phone' && !hasMinLength(values.phone, 7)) {
      return 'A phone number is needed to return a call. Pick email instead to skip it.'
    }
    return null
  }

  // A field is judged once the writer has left it, not while they are still
  // typing into it - an email is invalid for as long as it takes to type.
  const handleBlur = e => {
    const fault = faultIn(e.target.name, formData)
    setErrors(current => {
      const next = { ...current }
      if (fault) next[e.target.name] = fault
      else delete next[e.target.name]
      return next
    })
  }

  const validateForm = () => {
    const newErrors = {}
    for (const field of REQUIRED_FIELDS) {
      const fault = faultIn(field, formData)
      if (fault) newErrors[field] = fault
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length) {
      // Land on the first thing that needs fixing rather than leaving the
      // writer to find it.
      const first = REQUIRED_FIELDS.find(field => newErrors[field])
      if (FOLDED.includes(first) && folded.current) folded.current.open = true
      document.getElementById(FIELD_IDS[first] || first)?.focus()
    }
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async e => {
    e.preventDefault()

    if (status === 'submitting') return
    if (!validateForm()) return

    setErrors({})
    setStatus('submitting')

    try {
      await submitEnquiry({ ...formData, form: 'contact' })
      setStatus('sent')
      setFormData(BLANK)
    } catch (cause) {
      // A send that failed is a notice rather than a line in the form. The four
      // faults this form raises itself are each about one field and each sit
      // under it; this one is about none of them, and what the endpoint said
      // about it was written for the program that called it.
      setStatus('idle')
      toast(faultMessage(cause, NOT_SENT), 'error')
    }
  }

  const handleChange = e => {
    const next = { ...formData, [e.target.name]: e.target.value }
    if (e.target.name === 'contactMethod' && e.target.value === 'email') {
      next.phone = ''
      setErrors(current => {
        const rest = { ...current }
        delete rest.phone
        return rest
      })
    }
    setFormData(next)
    // A field showing an error clears it the moment it is right, so the message
    // does not sit under a corrected field waiting for a blur.
    if (errors[e.target.name] && !faultIn(e.target.name, next)) {
      setErrors(current => {
        const rest = { ...current }
        delete rest[e.target.name]
        return rest
      })
    }
  }

  const described = field => (errors[field] ? `${field}-error` : undefined)

  return (
    <div>
      <Seo
        title={CONTACT.seo.title}
        description={CONTACT.seo.description}
        path="/contact"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Contact', path: '/contact' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            url: `${SITE_URL}/contact`,
            mainEntity: { '@id': BUSINESS_ID },
          },
        ]}
      />

      <section className="glow pb-16 pt-10 sm:pb-24 sm:pt-16">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
          <div>
            <h1 className={TYPE.display}>{CONTACT.hero.title}</h1>
            <p className={`${TYPE.lead} mt-5 max-w-[30rem]`}>{CONTACT.hero.description}</p>
          </div>

          <div
            className={`${CARD} min-w-0 p-6 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start`}
          >
            {status === 'sent' ? (
              // A sent inquiry stands where the form stood. A toast is gone in
              // four seconds and takes the only acknowledgement with it.
              <div className="flex items-start gap-4 py-4" role="status">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(74,222,128,0.14)] text-[color:var(--live)]">
                  <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                </span>
                <div>
                  <p className={TYPE.h3}>Message sent.</p>
                  <p className={`${TYPE.body} mt-1`}>{CONTACT.form.confirmation}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="field"
                      placeholder="Your name"
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={described('name')}
                    />
                    <Fault id="name" error={errors.name} />
                  </div>
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
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="field"
                      placeholder={CONTACT.form.placeholders.email}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={described('email')}
                    />
                    <Fault id="email" error={errors.email} />
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
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="field resize-none py-3"
                    placeholder={CONTACT.form.placeholders.message}
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={described('message')}
                  />
                  <Fault id="message" error={errors.message} />
                </div>

                {/* The rest of what the form asks, a tap away. Nothing in here
                    is required unless the writer asks to be called. */}
                <details ref={folded} className="group rounded-[12px] bg-[var(--card-hi)]">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-[15px] font-medium text-[color:var(--link)] [&::-webkit-details-marker]:hidden">
                    <Plus
                      className="h-4 w-4 transition-transform duration-150 group-open:rotate-45"
                      aria-hidden="true"
                    />
                    Add More Detail (Optional)
                  </summary>
                  <div className="space-y-6 px-4 pb-5 pt-2">
                    <div>
                      <label htmlFor="company" className={FIELD_LABEL}>
                        {ASKED.company}
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        autoComplete="organization"
                        value={formData.company}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className="field"
                        placeholder={CONTACT.form.placeholders.company}
                      />
                    </div>

                    <fieldset>
                      <legend className={FIELD_LABEL}>{ASKED.projectType}</legend>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {CONTACT.projectTypes.map(kind => (
                          <label key={kind.value} className="relative block cursor-pointer">
                            <input
                              type="radio"
                              name="projectType"
                              value={kind.value}
                              checked={formData.projectType === kind.value}
                              onChange={handleChange}
                              className="sr-only"
                            />
                            <span className="choice-tile text-center">{kind.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <ContactMethodChoice
                      value={formData.contactMethod}
                      phone={formData.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={errors.phone}
                      idPrefix="contact"
                    />
                  </div>
                </details>

                <div className="pt-1 [&>button]:w-full">
                  <SendButton sending={status === 'submitting'}>{CONTACT.form.submit}</SendButton>
                </div>
              </form>
            )}
          </div>

          <div className="space-y-3">
            <a
              href={COMPANY_PHONE_HREF}
              className={`${CARD} flex items-center gap-4 p-5 transition-colors hover:bg-[var(--card-hi)]`}
            >
              <Face />
              <span>
                <span className="block text-[15px] font-medium text-ink">
                  Rather talk? Call or text {BIO_NAME.split(' ')[0]}.
                </span>
                <span className="mt-0.5 block text-[20px] font-semibold tracking-[-0.01em] text-[color:var(--link)]">
                  {COMPANY_PHONE}
                </span>
              </span>
            </a>
            <dl className={`${CARD} grid gap-4 px-5 py-4 sm:grid-cols-2`}>
              <div className="min-w-0">
                <dt className={TYPE.small}>Email</dt>
                <dd className="mt-0.5 truncate text-[16px] font-medium">
                  <a
                    href={`mailto:${SALES_EMAIL}`}
                    className="text-[color:var(--link)] hover:text-ink"
                  >
                    {SALES_EMAIL}
                  </a>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={TYPE.small}>{CONTACT.place.label}</dt>
                <dd className="mt-0.5 text-[16px] font-medium text-ink">{CONTACT.place.value}</dd>
              </div>
            </dl>
          </div>
        </Container>
      </section>
    </div>
  )
}
