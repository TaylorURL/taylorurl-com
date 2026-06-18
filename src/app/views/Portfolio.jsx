import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Globe } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { BTN_PRIMARY, SECTION_H2 } from '@constants/ui'
import { PORTFOLIO_PROJECTS } from '@data/portfolio'
import { breadcrumbSchema } from '@constants/seo'

/**
 * Live screenshot proxy that returns a PNG of the target URL with no API key
 * required. maxAge/24 forces a daily recapture so previews track the live
 * sites. The placeholder swatch shows until the image loads and remains in
 * place if the request fails.
 */
const SCREENSHOT_ENDPOINT = 'https://image.thum.io/get/maxAge/24/width/1280/crop/800'

function PortfolioCard({ project, index }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <motion.a
      {...staggerChild(index, 0.12)}
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-surface-raised transition duration-300 ease-out hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5"
      aria-label={`Open ${project.name} in a new tab`}
    >
      <div className="relative overflow-hidden border-b border-gray-100">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <div className="ml-3 flex flex-1 items-center gap-1.5 truncate rounded-md bg-white px-3 py-1 text-xs text-gray-400">
            <Globe className="h-3 w-3" strokeWidth={1.75} />
            <span className="truncate">{project.displayUrl}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-50">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${project.accent} transition-opacity duration-500 ${
              imageLoaded && !imageFailed ? 'opacity-0' : 'opacity-100'
            }`}
          />
          {!imageFailed && (
            <img
              src={`${SCREENSHOT_ENDPOINT}/${project.url}`}
              alt={`${project.name} homepage preview`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              className={`absolute inset-0 h-full w-full object-cover object-top transition-all duration-500 group-hover:scale-[1.02] ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
          {imageFailed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold tracking-tight text-white/80 mix-blend-overlay">
                {project.name}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-5 p-6">
        <div>
          <h3 className="mb-2 text-xl font-bold text-gray-900 transition-colors group-hover:text-blue-600">
            {project.name}
          </h3>
          <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
            {project.description}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600">
          Visit live site
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </motion.a>
  )
}

export default function Portfolio() {
  return (
    <div>
      <Seo
        title="Portfolio"
        description="A selection of client websites built by TaylorURL — modern, hand-coded React sites launched for local businesses in Baytown, Houston, and across Texas."
        path="/portfolio"
      />
      <PageHero
        title="Recent work"
        description="A look at the sites I have shipped for local businesses. Every project is hand-coded, hosted, and maintained from one source."
      />

      <section className="relative overflow-hidden bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
            {PORTFOLIO_PROJECTS.map((project, index) => (
              <PortfolioCard key={project.url} project={project} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-gray-200 bg-surface-base py-12 sm:py-20">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className={`mb-4 ${SECTION_H2}`}>
              Want your business <span className="logo-wave-dark">in this list</span>?
            </h2>
            <p className="mb-8 text-base text-gray-600 sm:text-lg">
              Tell me what your business needs and I will scope a build. Most projects launch in two
              to four weeks.
            </p>
            <div className="flex justify-center">
              <Link to="/contact" className={`group ${BTN_PRIMARY}`}>
                Get in Touch
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
