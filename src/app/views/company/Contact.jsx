import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight, Check, ChevronDown, Clock, Mail, Phone } from 'lucide-react'
import { DRAFTS } from '@constants/drafting'
import { GROUNDS } from '@constants/grounds'
import BbbSeal from '@components/reviews/BbbSeal'
import PageHero from '@components/page-bands/PageHero'
import Seo from '@components/Seo'
import { useToast } from '@hooks/chrome/useToast'
import { useScrollParallax } from '@hooks/scroll/useScrollParallax'
import {
  COMPANY_PHONE,
  COMPANY_PHONE_HREF,
  DEFAULT_CONTACT_METHOD,
  SALES_EMAIL,
} from '@constants/navigation'
import ContactMethodChoice from '@components/conversion/ContactMethodChoice'
import { fadeInUp, slideInLeftMount, slideInRightMount, staggerChild } from '@constants/animations'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import { BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'
import { QUESTIONS } from '@lib/enquiry/questions.js'
import { hasMinLength, isValidEmail } from '@utils/validation'
import { CONTACT } from '@data/pages/contact'
import { submitEnquiry, enquiryErrorMessage } from '@data/leads/sendEnquiry'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import Magnet from '@reactbits/Magnet/Magnet'
import { AccentGradient } from '@reactbits/kit'
import { PUBLISHES_REVIEWS, SITE } from '../../../../lib/site/current.js'

// The third row of the contact card says where the work happens, and the mark
// over it is part of that claim: a pin for a town the studio names, a globe for
// an offer with no address behind it.
const PlaceIcon = CONTACT.place.icon

const REQUIRED_FIELDS = ['name', 'email', 'phone', 'message']

// What a carried brief may be worth, so a crafted history entry cannot fill
// the box with a page of someone else's text.
const BRIEF_ROWS = 12
const BRIEF_LABEL = 60
const BRIEF_VALUE = 300

/**
 * The configuration a visitor arrives holding, written out as the message they
 * would otherwise have typed.
 *
 * The configurator asks five screens of questions and its pay step offers a
 * way here instead. What was picked has to come along, or the visitor who told
 * the site the most about their business is the one who arrives at this form
 * with nothing in it.
 *
 * It is read through its own shape rather than trusted. What arrives is
 * whatever is in the browser's history entry, it lands in a box a person is
 * about to send under their own name, and a row that is not a label and a
 * value is not part of a brief.
 *
 * @param {*} carried Whatever the route was entered with.
 * @returns {string} The message to open on, or empty where there is no brief.
 */
function briefText(carried) {
  if (!Array.isArray(carried)) return ''
  const rows = carried
    .filter(row => row && typeof row.label === 'string' && typeof row.value === 'string')
    .slice(0, BRIEF_ROWS)
    .map(row => `${row.label.slice(0, BRIEF_LABEL)}: ${row.value.slice(0, BRIEF_VALUE)}`)
  if (!rows.length) return ''
  return ['Here is what I picked on the start page:', '', ...rows, ''].join('\n')
}

// What this form asks, written once and read by both sides: the labels below
// and the notice the endpoint sends come from the same words, so rewording a
// field here rewords the inbox with it.
const ASKED = QUESTIONS.contact

// The reply-method fields are rendered by a shared component that prefixes its
// ids, so the field a fault belongs to is not always named after it.
const FIELD_IDS = { phone: 'contact-phone' }

// A sent inquiry stands where the form stood. A toast is gone in four seconds
// and takes the only acknowledgement with it, on the one form a visitor is
// most likely to have spent a minute filling in.
function Confirmation({ title, body }) {
  return (
    <div className="panel-static flex items-center gap-4 p-6" role="status">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-accent/50 bg-accent/10">
        <Check className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden="true" />
      </div>
      <div>
        <p className="section-label-sm text-accent">{title}</p>
        <p className="text-[15px] text-ink-paper">{body}</p>
      </div>
    </div>
  )
}

export default function Contact() {
  const toast = useToast()
  const { state } = useLocation()
  // Read once, on the mount the visitor arrived on. The box is theirs to edit
  // from that point, and a re-read would take back an edit they had made.
  const [formData, setFormData] = useState(() => ({
    name: '',
    email: '',
    company: '',
    projectType: '',
    contactMethod: DEFAULT_CONTACT_METHOD,
    phone: '',
    message: briefText(state?.brief),
  }))

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
      setFormData({
        name: '',
        email: '',
        company: '',
        projectType: '',
        contactMethod: DEFAULT_CONTACT_METHOD,
        phone: '',
        message: '',
      })
    } catch (error) {
      setStatus('idle')
      toast(enquiryErrorMessage(error), 'error')
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

  const labelClass = 'section-label-sm mb-2 block text-paper-faint'
  // A fault is a sentence rather than a standing label, so it is set as small
  // prose and left free to wrap.
  const errorClass = 'mt-2 text-[13px] leading-snug text-[color:var(--danger-on-paper)]'

  // Scroll-driven backdrop on the "What's included" band — the blueprint grid
  // drifts behind the static checklist as the band scrolls past, giving the
  // dark section depth without touching the copy itself.
  const { ref: includedRef, transform: includedGridTransform } = useScrollParallax({
    range: [0, -70],
  })

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
      <PageHero
        draft="ledger"
        eyebrow={CONTACT.hero.eyebrow}
        title={CONTACT.hero.title}
        description={CONTACT.hero.description}
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.column}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <div className="panel-static bg-hair-paper grid gap-px overflow-hidden lg:grid-cols-[1fr_1.4fr]">
            <m.aside {...slideInLeftMount} className="flex flex-col gap-10 bg-paper p-8 sm:p-12">
              <div>
                <p className="section-label mb-6 block text-accent">{CONTACT.aside.eyebrow}</p>
                <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink-paper [text-wrap:balance]">
                  {CONTACT.aside.heading}
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-paper-soft">
                  {CONTACT.aside.para}
                </p>
                <div className="border-hair-paper mt-8 border-t pt-7">
                  <div className="flex items-center gap-4">
                    <img
                      src="/images/trenton-taylor.webp"
                      srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
                      alt=""
                      width="80"
                      height="80"
                      loading="lazy"
                      decoding="async"
                      className="border-hair-paper-strong h-20 w-20 shrink-0 rounded-md border object-cover"
                    />
                    <div>
                      <p className="text-[15px] font-semibold text-ink-paper">Trenton Taylor</p>
                      <p className="section-label-sm text-paper-faint">{BIO_TITLE}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-[14px] leading-relaxed text-paper-soft">{BIO_TEXT}</p>
                </div>
              </div>

              <SpotlightCard
                className="panel-static bg-hair-paper space-y-px"
                spotlightColor="var(--spotlight-soft)"
              >
                <a
                  href={COMPANY_PHONE_HREF}
                  className="group flex items-center gap-4 bg-paper p-5 transition-colors hover:bg-ink-paper/[0.02]"
                >
                  <Phone className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="section-label-sm text-paper-faint">Phone</p>
                    <p className="truncate text-[14px] text-ink-paper">{COMPANY_PHONE}</p>
                  </div>
                  <ArrowUpRight className="text-paper-faint h-4 w-4 transition-colors group-hover:text-accent" />
                </a>
                <a
                  href={`mailto:${SALES_EMAIL}`}
                  className="group flex items-center gap-4 bg-paper p-5 transition-colors hover:bg-ink-paper/[0.02]"
                >
                  <Mail className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="section-label-sm text-paper-faint">Email</p>
                    <p className="truncate text-[14px] text-ink-paper">{SALES_EMAIL}</p>
                  </div>
                  <ArrowUpRight className="text-paper-faint h-4 w-4 transition-colors group-hover:text-accent" />
                </a>
                <div className="flex items-center gap-4 bg-paper p-5">
                  <PlaceIcon className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="section-label-sm text-paper-faint">{CONTACT.place.label}</p>
                    <p className="text-[14px] text-ink-paper">{CONTACT.place.value}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-paper p-5">
                  <Clock className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="section-label-sm text-paper-faint">Reply</p>
                    <p className="text-[14px] text-ink-paper">Usually within the hour</p>
                  </div>
                </div>
              </SpotlightCard>

              <div>
                <p className="section-label-sm text-paper-faint mb-4">What Happens Next</p>
                <ol className="space-y-5 border-l border-accent/40 pl-5">
                  {CONTACT.steps.map((step, i) => (
                    <li key={step.title} className="relative">
                      <span className="absolute -left-[29px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-accent bg-paper font-mono text-[11px] font-semibold tabular-nums text-accent">
                        {i + 1}
                      </span>
                      <p className="text-[14px] font-semibold text-ink-paper">{step.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-paper-soft">
                        {step.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* The column has said who answers, on what number, and how soon.
                  The seal is the one line of it a reader can go and check
                  against somebody other than me, so it closes the column. It is
                  the studio's accreditation, under the studio's name, so only
                  the site the reviews belong to draws it. */}
              {PUBLISHES_REVIEWS ? <BbbSeal /> : null}
            </m.aside>

            <m.div {...slideInRightMount} className="relative bg-paper p-8 sm:p-12">
              <div className="border-hair-paper mb-8 flex items-baseline justify-between border-b pb-5">
                <h3 className="text-[19px] font-semibold tracking-tight text-ink-paper">
                  {CONTACT.form.heading}
                </h3>
                <span className="section-label-sm text-paper-faint">Contact Form</span>
              </div>
              {status === 'sent' ? (
                <Confirmation title="Message Sent" body={CONTACT.form.confirmation} />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-7" noValidate>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className={labelClass}>
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
                        className="field py-3.5"
                        placeholder="Your name"
                        aria-invalid={errors.name ? true : undefined}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                      />
                      {errors.name && (
                        <p id="name-error" className={errorClass} role="alert">
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="email" className={labelClass}>
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
                        className="field py-3.5"
                        placeholder={CONTACT.form.placeholders.email}
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                      />
                      {errors.email && (
                        <p id="email-error" className={errorClass} role="alert">
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="company" className={labelClass}>
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
                        className="field py-3.5"
                        placeholder={CONTACT.form.placeholders.company}
                      />
                    </div>
                    <div>
                      <label htmlFor="projectType" className={labelClass}>
                        {ASKED.projectType}
                      </label>
                      {/* The arrow is drawn beside the select rather than painted
                        into it, so it takes the field's own ink under either
                        setting instead of a colour baked into an image. */}
                      <div className="relative">
                        <select
                          id="projectType"
                          name="projectType"
                          value={formData.projectType}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className="field appearance-none py-3.5 pr-10"
                        >
                          <option value="">Pick the closest one</option>
                          {CONTACT.projectTypes.map(kind => (
                            <option key={kind.value} value={kind.value}>
                              {kind.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          aria-hidden="true"
                          strokeWidth={1.5}
                          className="text-paper-faint pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                        />
                      </div>
                    </div>
                  </div>

                  <ContactMethodChoice
                    value={formData.contactMethod}
                    phone={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.phone}
                    idPrefix="contact"
                  />

                  <div>
                    <label htmlFor="message" className={labelClass}>
                      {ASKED.message}
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows={6}
                      className="field resize-none py-3.5"
                      placeholder={CONTACT.form.placeholders.message}
                      aria-invalid={errors.message ? true : undefined}
                      aria-describedby={errors.message ? 'message-error' : undefined}
                    />
                    {errors.message && (
                      <p id="message-error" className={errorClass} role="alert">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <div className="border-hair-paper flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <Magnet padding={60} magnetStrength={5}>
                      <button
                        type="submit"
                        disabled={status === 'submitting'}
                        className="btn btn-primary group"
                      >
                        {status === 'submitting' ? 'Sending…' : CONTACT.form.submit}
                        {status !== 'submitting' && (
                          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        )}
                      </button>
                    </Magnet>
                    <p className="section-label-sm text-paper-faint">
                      Free, and usually answered within the hour
                    </p>
                  </div>
                </form>
              )}
            </m.div>
          </div>
        </div>
      </section>

      <section
        ref={includedRef}
        data-ground="band"
        className="border-hair section-y relative overflow-hidden border-t bg-bg text-ink"
      >
        <m.div
          style={{ transform: includedGridTransform }}
          className={`absolute inset-0 ${GROUNDS.band.grid} ${DRAFTS.ledger}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <m.div
            {...fadeInUp}
            className="border-hair grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="section-label mb-6 block text-accent">{CONTACT.included.eyebrow}</p>
              <h2 className="display-4 font-semibold leading-[1.05] tracking-tightest text-ink [text-wrap:balance]">
                {CONTACT.included.headingLine} <br />
                <AccentGradient>{CONTACT.included.accentText}</AccentGradient>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
              {CONTACT.included.lede}
            </p>
          </m.div>
          <div className="mt-12 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
            {CONTACT.includedItems.map((item, i) => (
              <m.div
                key={item}
                {...staggerChild(i, 0.04)}
                className="border-hair flex items-start gap-3 border-t pt-3"
              >
                <span className="font-mono text-[10px] tabular-nums tracking-tight text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[14px] text-ink-soft">{item}</span>
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" strokeWidth={2} />
              </m.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
