import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Check, Clock, Mail, MapPin } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { useToast } from '@hooks/useToast'
import { COMPANY_LOCATION, SALES_EMAIL } from '@constants/navigation'
import { slideInLeftMount, slideInRightMount } from '@constants/animations'
import { INPUT } from '@constants/ui'
import { BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'

const INCLUDED_ITEMS = [
  'Custom website design',
  'Works on every device',
  'Hosting taken care of',
  'Regular updates and fixes',
  'Watched around the clock',
  'Quick to spot and fix issues',
  'Quick page loads',
  'Daily backups',
  'Content updates',
  'A real person to call',
]

const CONTACT_STEPS = [
  {
    title: 'First call',
    description:
      'You walk me through the business. I ask the questions I need to plan the work and give you an honest answer.',
  },
  {
    title: 'Clear plan',
    description:
      'You get a written plan: what gets built, how long it takes, what’s included, and what happens after launch.',
  },
  {
    title: 'Build and go live',
    description:
      'I build the site, share progress along the way, and put it online. Ongoing care is included.',
  },
]

export default function Contact() {
  const toast = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    projectType: '',
    message: '',
  })

  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Name is required and must be at least 2 characters.'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email || !emailRegex.test(formData.email)) {
      newErrors.email = 'A valid email address is required.'
    }

    if (!formData.message || formData.message.trim().length < 10) {
      newErrors.message = 'Message is required and must be at least 10 characters.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = e => {
    e.preventDefault()

    if (!validateForm()) return

    setErrors({})

    const subject = `New Project Inquiry from ${formData.name}`
    const body = `
Name: ${formData.name}
Email: ${formData.email}
Business: ${formData.company || 'N/A'}
Project Type: ${formData.projectType || 'Not specified'}

Message:
${formData.message}
    `.trim()

    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    toast('Opening your email. I’ll get back to you within 24 hours.')
  }

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const labelClass =
    'mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint'
  const errorClass = 'mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-red-600'

  return (
    <div>
      <Seo
        title="Contact a Baytown Web Designer"
        description="Tell me about your Baytown or Houston-area business and what you need from a website. I get back to you within 24 hours, with an honest answer."
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
        eyebrow="// 01 — Get in touch"
        title="Let's talk about your website."
        description="Tell me about your Baytown or Houston-area business. I get back within 24 hours, with an honest answer — no sales pitch."
      />

      <section className="relative overflow-hidden bg-paper py-24 sm:py-32">
        <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <div className="grid gap-px overflow-hidden border border-hair-paper bg-hair-paper lg:grid-cols-[1fr_1.4fr]">
            <motion.aside
              {...slideInLeftMount}
              className="flex flex-col gap-10 bg-paper p-8 sm:p-12"
            >
              <div>
                <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                  <span className="h-px w-8 bg-accent" />
                  // Get in touch
                </p>
                <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink-paper">
                  Start the conversation.
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-paper-soft">
                  New site, redoing an old one, or taking over a site someone else built —
                  tell me about the business and what needs to change.
                </p>
              </div>

              <div className="space-y-px overflow-hidden border border-hair-paper bg-hair-paper">
                <a
                  href={`mailto:${SALES_EMAIL}`}
                  className="group flex items-center gap-4 bg-paper p-5 transition-colors hover:bg-ink-paper/[0.02]"
                >
                  <Mail className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      Email
                    </p>
                    <p className="truncate text-[14px] text-ink-paper">{SALES_EMAIL}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-paper-faint transition-colors group-hover:text-accent" />
                </a>
                <div className="flex items-center gap-4 bg-paper p-5">
                  <MapPin className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      Location
                    </p>
                    <p className="text-[14px] text-ink-paper">{COMPANY_LOCATION}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-paper p-5">
                  <Clock className="h-5 w-5 flex-shrink-0 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                      Reply time
                    </p>
                    <p className="text-[14px] text-ink-paper">Within 24 hours</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                  // What happens next
                </p>
                <ol className="space-y-5 border-l border-accent/40 pl-5">
                  {CONTACT_STEPS.map((step, i) => (
                    <li key={step.title} className="relative">
                      <span className="absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-accent bg-paper font-mono text-[9px] font-semibold text-accent">
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
            </motion.aside>

            <motion.div
              {...slideInRightMount}
              className="bg-paper p-8 sm:p-12"
            >
              <div className="mb-8 flex items-baseline justify-between border-b border-hair-paper pb-5">
                <h3 className="text-[20px] font-semibold tracking-tight text-ink-paper">
                  Tell me about it
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                  Contact form
                </span>
              </div>
              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className={labelClass}>
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className={INPUT}
                      placeholder="Your name"
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                    />
                    {errors.name && (
                      <p id="name-error" className={errorClass}>
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className={INPUT}
                      placeholder="you@yourbusiness.com"
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                    />
                    {errors.email && (
                      <p id="email-error" className={errorClass}>
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="company" className={labelClass}>
                      Business name
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className={INPUT}
                      placeholder="Your business name"
                    />
                  </div>
                  <div>
                    <label htmlFor="projectType" className={labelClass}>
                      What do you need
                    </label>
                    <select
                      id="projectType"
                      name="projectType"
                      value={formData.projectType}
                      onChange={handleChange}
                      className={`${INPUT} bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")] appearance-none bg-[length:1.1rem] bg-[position:right_0.85rem_center] bg-no-repeat pr-10`}
                    >
                      <option value="">Pick one</option>
                      <option value="new-website">A brand-new website</option>
                      <option value="redesign">Redo my current site</option>
                      <option value="web-app">Online booking or a custom tool</option>
                      <option value="optimization">Make my site faster</option>
                      <option value="maintenance">Take over hosting and care</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className={labelClass}>
                    Tell me about it
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    className={`${INPUT} resize-none`}
                    placeholder="What does your business do, and what do you want your website to do for you?"
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                  />
                  {errors.message && (
                    <p id="message-error" className={errorClass}>
                      {errors.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-4 border-t border-hair-paper pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
                  >
                    Send message
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper-faint">
                    Opens your email client
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-hair bg-bg py-20 text-ink sm:py-28">
        <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid items-end gap-10 border-b border-hair pb-12 lg:grid-cols-[1.4fr_1fr]"
          >
            <div>
              <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <span className="h-px w-8 bg-accent" />
                // Included
              </p>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-[1.05] tracking-tightest text-ink">
                Everything standard
                <br />
                <span className="text-accent">with every project.</span>
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
              No surprise charges for the basics. Ten things that ship with every build,
              every time.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
            {INCLUDED_ITEMS.map((item, i) => (
              <div key={item} className="flex items-start gap-3 border-t border-hair pt-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[14px] text-ink-soft">{item}</span>
                <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" strokeWidth={2} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
