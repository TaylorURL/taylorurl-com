import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { staggerChild } from '@constants/animations'
import { SECTION_H2 } from '@constants/ui'

const TESTIMONIALS = [
  {
    name: 'Maria Rodriguez',
    business: 'Rodriguez Family Restaurant',
    role: 'Owner',
    color: 'bg-orange-500',
    quote:
      "They just handle it. I don't know anything about websites and I don't want to. Online orders are up 40% since launch and I didn't have to learn a single thing.",
  },
  {
    name: 'James Mitchell',
    business: 'Mitchell Plumbing & HVAC',
    role: 'Owner',
    color: 'bg-blue-600',
    quote:
      'Went from maybe 2-3 internet calls a week to 2-3 a day. I text them when I need something changed and it just gets done. No tickets, no waiting.',
  },
  {
    name: 'Sarah Chen',
    business: 'Precision Auto Works',
    role: 'General Manager',
    color: 'bg-emerald-500',
    quote:
      "We had nothing online. Now we're the top search result in our area. The site paid for itself in the first month from new customers alone.",
  },
]

function StarRating() {
  return (
    <div className="flex gap-0.5" role="img" aria-label="Rated 5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} aria-hidden="true" className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  )
}

function Avatar({ name, color }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full ${color} text-sm font-bold text-white shadow-md`}
    >
      {initials}
    </div>
  )
}

export default function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-14 sm:py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className={`mb-4 ${SECTION_H2}`}>
            Don&apos;t Take Our <span className="logo-wave-dark">Word for It</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Hear it from the people who actually write the checks.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              {...staggerChild(index)}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-lg sm:p-8"
            >
              <StarRating />
              <p className="mt-4 text-base italic leading-relaxed text-gray-600">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar name={testimonial.name} color={testimonial.color} />
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">
                    {testimonial.role}, {testimonial.business}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
