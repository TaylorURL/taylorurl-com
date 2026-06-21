import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'

export default function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-hair bg-bg py-28 text-ink sm:py-40">
      <div className="grid-blueprint absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
        aria-hidden="true"
      />

      <motion.div
        {...fadeInUp}
        className="relative mx-auto w-full max-w-[1280px] px-6 text-center sm:px-10 lg:px-16"
      >
        <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
          <span className="h-px w-8 bg-accent" />
          // 05 — Let&apos;s talk
          <span className="h-px w-8 bg-accent" />
        </p>
        <h2 className="mx-auto max-w-4xl text-[clamp(2.4rem,7vw,5.6rem)] font-semibold leading-[0.98] tracking-tightest text-ink">
          Ready to <span className="text-accent">get started</span>?
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft sm:text-[19px]">
          I take care of the tech side — keeping your site online, fast, and safe. You just
          tell me about the business and what you need.
        </p>
        <div className="mt-12 flex justify-center">
          <Link
            to="/contact"
            className="group inline-flex items-center gap-2.5 rounded-sm bg-accent px-8 py-4 font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98]"
          >
            Get in touch
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <p className="mx-auto mt-12 max-w-md font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Reply within 24 hours · No sales pitch · Honest answers
        </p>
      </motion.div>
    </section>
  )
}
