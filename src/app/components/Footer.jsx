import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Mail, MapPin } from 'lucide-react'
import { COMPANY_LOCATION, CONTACT_EMAIL, LEGAL_LINKS, PRIMARY_LINKS } from '@constants/navigation'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-gray-50 px-4 pb-8 pt-16 md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-6xl"
      >
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link to="/" className="mb-5 inline-block">
              <span className="text-xl font-bold tracking-tight text-gray-900">
                Taylor<span className="text-blue-600">URL</span>
              </span>
            </Link>
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-gray-500">
              Professional web development for businesses in the Houston area and beyond.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-500">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{COMPANY_LOCATION}</span>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-2.5 text-sm text-gray-500 transition-colors hover:text-blue-600"
              >
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{CONTACT_EMAIL}</span>
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
            <Link
              to="/pricing"
              className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Get a Quote
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 sm:flex-row">
          <p className="text-sm text-gray-400">
            &copy; {currentYear} TaylorURL. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            <span>All systems operational</span>
          </div>
        </div>
      </motion.div>
    </footer>
  )
}
