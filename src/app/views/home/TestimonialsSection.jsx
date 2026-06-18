import { motion } from 'framer-motion'
import { PencilLine, Star } from 'lucide-react'
import TrustpilotBadge from '@components/TrustpilotBadge'
import { staggerChild } from '@constants/animations'
import { CLIENT_TESTIMONIALS } from '@data/home'
import { SECTION_H2 } from '@constants/ui'

// TODO: If the canonical Trustpilot profile slug ever differs from the bare
// domain, replace this constant — both CTA URLs and the rating API derive from
// the same value.
const TRUSTPILOT_DOMAIN = 'taylorurl.com'
const TRUSTPILOT_PROFILE_URL = `https://www.trustpilot.com/review/${TRUSTPILOT_DOMAIN}`
const TRUSTPILOT_EVALUATE_URL = `https://www.trustpilot.com/evaluate/${TRUSTPILOT_DOMAIN}`

const TRUSTPILOT_BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-semibold transition duration-200 ease-out active:scale-[0.97]'

const TRUSTPILOT_BTN_PRIMARY = `${TRUSTPILOT_BTN_BASE} bg-[#00b67a] text-white shadow-sm shadow-[#00b67a]/25 hover:bg-[#00a36b] hover:shadow-lg hover:shadow-[#00b67a]/30`

const TRUSTPILOT_BTN_SECONDARY = `${TRUSTPILOT_BTN_BASE} border border-[#00b67a]/30 bg-white text-[#007a52] hover:border-[#00b67a] hover:bg-[#00b67a]/5`

function TrustpilotStar({ className = 'h-4 w-4' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <polygon points="12,2 14.85,8.63 22,9.27 16.5,14.14 18.18,21.02 12,17.27 5.82,21.02 7.5,14.14 2,9.27 9.15,8.63" />
    </svg>
  )
}

function ClientStarRow() {
  return (
    <div className="flex gap-0.5" role="img" aria-label="Rated 5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} aria-hidden="true" className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  )
}

function ClientAvatar({ name, color }) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full ${color} text-sm font-bold text-white shadow-md`}
    >
      {initials}
    </div>
  )
}

function ClientTestimonialCard({ testimonial, index }) {
  return (
    <motion.figure
      {...staggerChild(index)}
      whileHover={{ y: -4 }}
      className="flex h-full flex-col rounded-2xl border border-gray-200 bg-surface-overlay p-6 transition-shadow hover:shadow-lg sm:p-8"
    >
      <ClientStarRow />
      <blockquote className="mt-4 flex-1 text-base italic leading-relaxed text-gray-600">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <ClientAvatar name={testimonial.name} color={testimonial.color} />
        <div>
          <div className="font-semibold text-gray-900">{testimonial.name}</div>
          <div className="text-sm text-gray-500">
            {testimonial.role}, {testimonial.business}
          </div>
        </div>
      </figcaption>
    </motion.figure>
  )
}

export default function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-14 sm:py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10 text-center sm:mb-12">
          <h2 className={`mb-4 ${SECTION_H2}`}>
            What clients <span className="logo-wave-dark">say</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            A few words from local business owners I have built and looked after websites for.
          </p>
          <div className="mt-8 flex justify-center">
            <TrustpilotBadge profileUrl={TRUSTPILOT_PROFILE_URL} />
          </div>
        </div>

        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          {CLIENT_TESTIMONIALS.map((testimonial, index) => (
            <ClientTestimonialCard
              key={testimonial.name}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:mt-14 sm:flex-row sm:gap-4">
          <a
            href={TRUSTPILOT_EVALUATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={TRUSTPILOT_BTN_PRIMARY}
          >
            <PencilLine aria-hidden="true" className="h-4 w-4" />
            Leave us a review
            <TrustpilotStar />
          </a>
          <a
            href={TRUSTPILOT_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={TRUSTPILOT_BTN_SECONDARY}
          >
            See our reviews on Trustpilot
            <TrustpilotStar className="h-4 w-4 text-[#00b67a]" />
          </a>
        </div>
      </div>
    </section>
  )
}
