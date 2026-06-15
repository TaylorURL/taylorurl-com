import { Link } from 'react-router-dom'
import { ArrowRight, Phone } from 'lucide-react'
import { PHONE_NUMBER } from '@constants/navigation'
import { BTN_PRIMARY_LG, BTN_SECONDARY_DARK_LG } from '@constants/ui'

export default function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-gray-900 py-14 sm:py-24">
      <div className="grid-pattern-blue absolute inset-0 opacity-[0.04]" />
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
          Ready to <span className="logo-wave">Stop Overthinking It</span>?
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-gray-400 sm:text-lg">
          You don&apos;t need to understand hosting, SSL, or DNS. That&apos;s literally my job.
          Just tell me what you need and I&apos;ll take it from there.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/pricing" className={`group ${BTN_PRIMARY_LG}`}>
            Get Your Free Quote
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a href={`tel:${PHONE_NUMBER}`} className={BTN_SECONDARY_DARK_LG}>
            <Phone className="h-5 w-5" />
            Call Me
          </a>
        </div>
      </div>
    </section>
  )
}
