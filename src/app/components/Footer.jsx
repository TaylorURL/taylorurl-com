import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Facebook, Mail, MapPin } from 'lucide-react'
import { COMPANY_LOCATION, LEGAL_LINKS, PRIMARY_LINKS, SUPPORT_EMAIL } from '@constants/navigation'
import { fadeInUp } from '@constants/animations'
import { BTN_PRIMARY_SM } from '@constants/ui'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden border-t border-gray-200 bg-gray-50 px-4 pb-8 pt-16 md:px-6">
      <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
      <motion.div
        {...fadeInUp}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-6xl"
      >
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link to="/" className="mb-5 inline-block">
              <img
                src="/images/TaylorURL-Logo.png"
                alt="TaylorURL — websites for small businesses in Baytown, TX"
                width="112"
                height="112"
                loading="lazy"
                decoding="async"
                className="h-28 w-auto"
              />
            </Link>
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-gray-500">
              Custom websites for small businesses across Baytown, Houston, Pasadena, Deer
              Park, La Porte, and the greater Houston area. Built and looked after by Trenton
              Taylor.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-500">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{COMPANY_LOCATION}</span>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-2.5 text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{SUPPORT_EMAIL}</span>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61591005089902"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex items-center gap-2.5 text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                <Facebook className="h-4 w-4 text-gray-400" />
                <span>Facebook</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Navigate</h3>
            <ul className="space-y-2.5">
              {PRIMARY_LINKS.map(item => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/faq"
                  className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Legal</h3>
            <ul className="mb-8 space-y-2.5">
              {LEGAL_LINKS.map(item => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/contact" className={`group ${BTN_PRIMARY_SM}`}>
              Get in Touch
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Serving</h3>
          <p className="text-xs leading-relaxed text-gray-400">
            Baytown, TX &middot; Houston, TX &middot; Pasadena, TX &middot; Deer Park, TX &middot;
            La Porte, TX &middot; Mont Belvieu, TX &middot; League City, TX &middot; Pearland, TX
            &middot; Sugar Land, TX &middot; Katy, TX &middot; Galveston, TX &middot; Texas City, TX
            &middot; Webster, TX &middot; Friendswood, TX &middot; Humble, TX &middot; Spring, TX
            &middot; The Woodlands, TX
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row">
          <p className="text-sm text-gray-400">
            &copy; {currentYear} TaylorURL LLC. All rights reserved.
          </p>
          <Link
            to="/status"
            className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            <span>Everything running smoothly</span>
          </Link>
        </div>
      </motion.div>
    </footer>
  )
}
