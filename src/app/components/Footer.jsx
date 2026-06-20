import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, Facebook, Mail, MapPin } from 'lucide-react'
import { COMPANY_LOCATION, LEGAL_LINKS, PRIMARY_LINKS, SUPPORT_EMAIL } from '@constants/navigation'
import { fadeInUp } from '@constants/animations'

const SERVING = [
  'Baytown',
  'Houston',
  'Pasadena',
  'Deer Park',
  'La Porte',
  'Mont Belvieu',
  'League City',
  'Pearland',
  'Sugar Land',
  'Katy',
  'Galveston',
  'Texas City',
  'Webster',
  'Friendswood',
  'Humble',
  'Spring',
  'The Woodlands',
]

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden border-t border-hair bg-bg text-ink">
      <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      <motion.div
        {...fadeInUp}
        className="relative mx-auto w-full max-w-[1280px] px-6 pb-12 pt-24 sm:px-10 sm:pt-28 lg:px-16"
      >
        {/* Top monolithic mark */}
        <div className="mb-16 grid gap-10 border-b border-hair pb-16 sm:mb-20 sm:pb-20 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-md">
            <Link to="/" className="mb-8 inline-block">
              <img
                src="/images/TaylorURL-Logo.png"
                alt="TaylorURL — custom websites for local businesses in Baytown, TX"
                width="180"
                height="180"
                loading="lazy"
                decoding="async"
                className="h-32 w-auto sm:h-36"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </Link>
            <p className="mb-8 text-[15px] leading-relaxed text-ink-soft">
              Custom websites for shops, restaurants, trades, contractors, and independent
              pros around Baytown, Houston, and the rest of Southeast Texas. Built and
              looked after by one person, with a direct line you can actually reach.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[13px] text-ink-mute">
                <MapPin className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>{COMPANY_LOCATION}</span>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-3 text-[13px] text-ink-mute transition-colors hover:text-accent"
              >
                <Mail className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>{SUPPORT_EMAIL}</span>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61591005089902"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex items-center gap-3 text-[13px] text-ink-mute transition-colors hover:text-accent"
              >
                <Facebook className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <span>Facebook</span>
              </a>
            </div>
          </div>

          <div>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              Sitemap
            </p>
            <ul className="space-y-3">
              {PRIMARY_LINKS.map(item => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="group inline-flex items-center gap-2 text-[14px] text-ink-soft transition-colors hover:text-ink"
                  >
                    {item.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/faq"
                  className="group inline-flex items-center gap-2 text-[14px] text-ink-soft transition-colors hover:text-ink"
                >
                  FAQ
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              Legal
            </p>
            <ul className="space-y-3">
              {LEGAL_LINKS.map(item => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="group inline-flex items-center gap-2 text-[14px] text-ink-soft transition-colors hover:text-ink"
                  >
                    {item.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/status"
                  className="group inline-flex items-center gap-2 text-[14px] text-ink-soft transition-colors hover:text-ink"
                >
                  System status
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              Talk
            </p>
            <Link
              to="/contact"
              className="group inline-flex items-center gap-2.5 rounded-sm border border-hair-strong px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink transition duration-200 ease-out hover:bg-accent hover:border-accent active:scale-[0.98]"
            >
              Start a project
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-5 text-[13px] leading-relaxed text-ink-mute">
              Send a note. You’ll hear back within 24 hours.
            </p>
          </div>
        </div>

        {/* Monumental wordmark band */}
        <div className="mb-16 sm:mb-20">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Service area
          </p>
          <div
            aria-hidden="true"
            className="select-none whitespace-pre-wrap text-[clamp(2.5rem,9vw,7rem)] font-semibold leading-[0.92] tracking-tightest text-ink-faint"
          >
            {SERVING.map((c, i) => (
              <span key={c}>
                {c}
                {i < SERVING.length - 1 && <span className="text-accent"> · </span>}
              </span>
            ))}
          </div>
          <p className="sr-only">Serving {SERVING.join(', ')}.</p>
        </div>

        <div className="flex flex-col gap-6 border-t border-hair pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            <span>© {currentYear} TaylorURL LLC</span>
            <span className="hidden sm:inline">·</span>
            <span>Baytown, TX — US</span>
          </div>
          <Link
            to="/status"
            className="group inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-mute transition-colors hover:text-ink"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            All sites up and running
          </Link>
        </div>
      </motion.div>
    </footer>
  )
}
