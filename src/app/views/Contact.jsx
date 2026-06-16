import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, Mail, MapPin, Send } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { useToast } from '@components/Toast'
import { COMPANY_LOCATION, SALES_EMAIL } from '@constants/navigation'
import { slideInLeftMount, slideInRightMount } from '@constants/animations'
import { BTN_PRIMARY_LG, INPUT, SECTION_H2, SECTION_H2_DARK } from '@constants/ui'

const INCLUDED_ITEMS = [
  'Custom website design',
  'Responsive development',
  'Website hosting',
  'Regular updates and patches',
  'Security monitoring',
  'Bug fixes',
  'Performance optimization',
  'Backup management',
  'Content updates',
  'Technical support',
]

const PROCESS_STEPS = [
  {
    title: 'Initial call',
    description:
      'You walk me through the business. I ask the questions needed to scope the work and give you a direct answer.',
  },
  {
    title: 'Clear scope',
    description:
      'You get a written scope: what gets built, how long it takes, what is included, and what happens after launch.',
  },
  {
    title: 'Build and launch',
    description:
      'I build the site, share progress as it goes, and launch it. Ongoing support is included.',
  },
]

const INPUT_CLASS = INPUT

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
    toast("Opening your email client — I'll get back to you within 24 hours!")
  }

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div>
      <Seo
        title="Get in Touch"
        description="Tell me about your local business and the site you need. I build modern websites and JavaScript applications for shops, restaurants, trades, and independent professionals in the Baytown and Houston area."
        path="/contact"
      />
      <PageHero
        title="Get in Touch"
        description="Tell me about your local business. I'll get back to you within 24 hours."
      />

      <section className="bg-surface-base py-12 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
            <motion.div
              {...slideInLeftMount}
              transition={{ duration: 0.5 }}
              className="lg:col-span-2"
            >
              <h2 className={`mb-6 ${SECTION_H2}`}>
                Let&apos;s <span className="logo-wave-dark">Talk</span>
              </h2>
              <p className="mb-8 text-gray-600">
                New site, redesign, or need someone to take over a site you already have — tell me
                what your business does and what you&apos;re trying to fix. I&apos;ll take it from
                there.
              </p>

              <div className="mb-8 space-y-4">
                <a
                  href={`mailto:${SALES_EMAIL}`}
                  className="group flex items-start gap-4 rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900">
                    <Mail className="h-5 w-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Email</div>
                    <div className="text-sm text-gray-500">{SALES_EMAIL}</div>
                  </div>
                </a>

                <div className="flex items-start gap-4 rounded-xl border border-gray-200 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900">
                    <MapPin className="h-5 w-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Location</div>
                    <div className="text-sm text-gray-500">{COMPANY_LOCATION}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-xl border border-gray-200 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900">
                    <Clock className="h-5 w-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Response Time</div>
                    <div className="text-sm text-gray-500">Within 24 hours</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-6">
                <h3 className="mb-4 font-semibold text-gray-900">How It Works</h3>
                <div className="space-y-4">
                  {PROCESS_STEPS.map((step, i) => (
                    <div key={step.title} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-medium text-gray-700">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{step.title}</div>
                        <div className="text-sm text-gray-500">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              {...slideInRightMount}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-3"
            >
              <div className="rounded-2xl border border-gray-200 bg-surface-raised p-5 shadow-sm sm:p-8">
                <h3 className="mb-6 text-xl font-semibold text-gray-900">
                  Tell Me About Your Business
                </h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="name"
                        className="mb-2 block text-sm font-medium text-gray-900"
                      >
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className={INPUT_CLASS}
                        placeholder="Your name"
                        aria-invalid={errors.name ? true : undefined}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                      />
                      {errors.name && (
                        <p id="name-error" className="mt-1 text-sm text-red-500">
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-medium text-gray-900"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className={INPUT_CLASS}
                        placeholder="you@yourbusiness.com"
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                      />
                      {errors.email && (
                        <p id="email-error" className="mt-1 text-sm text-red-500">
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="company"
                        className="mb-2 block text-sm font-medium text-gray-900"
                      >
                        Business Name
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className={INPUT_CLASS}
                        placeholder="Your business name"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="projectType"
                        className="mb-2 block text-sm font-medium text-gray-900"
                      >
                        Project Type
                      </label>
                      <select
                        id="projectType"
                        name="projectType"
                        value={formData.projectType}
                        onChange={handleChange}
                        className={`${INPUT} bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")] appearance-none bg-[length:1.25rem] bg-[position:right_0.75rem_center] bg-no-repeat`}
                      >
                        <option value="">Select type</option>
                        <option value="new-website">New Website</option>
                        <option value="redesign">Website Redesign</option>
                        <option value="web-app">Web Application</option>
                        <option value="optimization">Performance Optimization</option>
                        <option value="maintenance">Ongoing Maintenance</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-sm font-medium text-gray-900"
                    >
                      Project Details
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className={`${INPUT_CLASS} resize-none`}
                      placeholder="What does your business do, and what do you need from a website?"
                      aria-invalid={errors.message ? true : undefined}
                      aria-describedby={errors.message ? 'message-error' : undefined}
                    />
                    {errors.message && (
                      <p id="message-error" className="mt-1 text-sm text-red-500">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                    <button type="submit" className={BTN_PRIMARY_LG}>
                      Send It
                      <Send className="h-4 w-4" />
                    </button>
                    <p className="text-xs text-gray-500">Opens your email client</p>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gray-950 py-16">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <h2 className={`mb-4 ${SECTION_H2_DARK}`}>
              Everything&apos;s <span className="logo-wave">Included</span>
            </h2>
            <p className="text-gray-400">
              All of this comes with the site. You won&apos;t get nickel-and-dimed for the basics.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {INCLUDED_ITEMS.map(item => (
              <div key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" strokeWidth={2} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
