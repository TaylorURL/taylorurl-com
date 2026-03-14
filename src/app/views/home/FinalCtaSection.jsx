import { Link } from 'react-router-dom'
import { ArrowRight, Phone } from 'lucide-react'
import { PHONE_NUMBER } from '@constants/navigation'

export default function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-gray-900 py-24">
      <div className="grid-pattern-blue absolute inset-0 opacity-[0.04]" />
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
          Ready to <span className="logo-wave">Stop Overthinking It</span>?
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-400">
          You don&apos;t need to understand hosting, SSL, or DNS. That&apos;s literally our job.
          Just tell us what you need and we&apos;ll take it from there.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white transition-all duration-300 hover:scale-105 hover:bg-blue-700"
          >
            Get Your Free Quote
            <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-600 px-8 py-4 text-lg font-medium text-white transition-all duration-300 hover:scale-105 hover:border-gray-400 hover:bg-gray-800"
          >
            <Phone className="h-5 w-5" />
            Call Us
          </a>
        </div>
      </div>
    </section>
  )
}
