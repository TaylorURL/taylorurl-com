import { motion } from 'framer-motion'
import { ArrowUpRight, PencilLine, Star } from 'lucide-react'
import TrustpilotBadge from '@components/TrustpilotBadge'
import { fadeInUp, staggerChild } from '@constants/animations'
import { CLIENT_TESTIMONIALS } from '@data/home'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import DecryptedText from '@reactbits/DecryptedText/DecryptedText'
import { AccentGradient } from '@reactbits/kit'

const TRUSTPILOT_DOMAIN = 'taylorurl.com'
const TRUSTPILOT_PROFILE_URL = `https://www.trustpilot.com/review/${TRUSTPILOT_DOMAIN}`
const TRUSTPILOT_EVALUATE_URL = `https://www.trustpilot.com/evaluate/${TRUSTPILOT_DOMAIN}`

function ClientStarRow() {
  return (
    <div className="flex gap-0.5" role="img" aria-label="Rated 5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} aria-hidden="true" className="h-4 w-4 fill-accent text-accent" />
      ))}
    </div>
  )
}

function ClientAvatar({ name }) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
  return (
    <div className="border-hair-paper-strong flex h-11 w-11 items-center justify-center rounded-sm border bg-paper text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-paper">
      {initials}
    </div>
  )
}

function ClientTestimonialCard({ testimonial, index }) {
  return (
    <motion.figure {...staggerChild(index, 0.06)} className="h-full">
      <SpotlightCard
        className="group flex h-full flex-col gap-8 bg-paper p-8 sm:p-10"
        spotlightColor="rgba(47,107,255,0.14)"
      >
      <div className="flex items-center justify-between">
        <ClientStarRow />
        <span className="text-paper-faint font-mono text-[10px] uppercase tracking-[0.22em]">
          {String(index + 1).padStart(2, '0')} / 03
        </span>
      </div>
      <blockquote className="flex-1 text-[18px] leading-[1.5] tracking-tight text-ink-paper">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="border-hair-paper flex items-center gap-4 border-t pt-5">
        <ClientAvatar name={testimonial.name} />
        <div>
          <div className="text-[14px] font-semibold text-ink-paper">{testimonial.name}</div>
          <div className="text-paper-faint font-mono text-[10px] uppercase tracking-[0.18em]">
            {testimonial.role} — {testimonial.business}
          </div>
        </div>
      </figcaption>
      </SpotlightCard>
    </motion.figure>
  )
}

export default function TestimonialsSection() {
  return (
    <section className="border-hair-paper relative overflow-hidden border-t bg-paper py-24 sm:py-36">
      <div className="grid-blueprint-paper-fine absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
        <motion.div
          {...fadeInUp}
          className="border-hair-paper grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              <DecryptedText
                text="// 03 — Reviews"
                animateOn="view"
                sequential
                speed={40}
                maxIterations={12}
              />
            </p>
            <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink-paper">
              Owners who
              <br />
              <AccentGradient>picked up the phone.</AccentGradient>
            </h2>
          </div>
          <div className="flex flex-col items-start gap-6 lg:items-end">
            <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
              A few words from local business owners I’ve built and looked after sites for around
              Baytown and the Houston area.
            </p>
            <TrustpilotBadge profileUrl={TRUSTPILOT_PROFILE_URL} variant="paper" />
          </div>
        </motion.div>

        <div className="border-hair-paper bg-hair-paper mt-12 grid gap-px overflow-hidden border md:mt-16 md:grid-cols-3">
          {CLIENT_TESTIMONIALS.map((testimonial, index) => (
            <ClientTestimonialCard key={testimonial.name} testimonial={testimonial} index={index} />
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:mt-14 sm:flex-row sm:gap-4">
          <a
            href={TRUSTPILOT_EVALUATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
          >
            <PencilLine aria-hidden="true" className="h-3.5 w-3.5" />
            Leave a review
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
          <a
            href={TRUSTPILOT_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-hair-paper-strong group inline-flex items-center gap-2.5 rounded-sm border px-7 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-paper transition duration-200 ease-out hover:bg-ink-paper hover:text-paper active:scale-[0.98]"
          >
            See all reviews
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
