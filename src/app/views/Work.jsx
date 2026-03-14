import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import PageHero from '@components/PageHero'
import Seo from '@components/Seo'
import useCountUp from '@hooks/useCountUp'
import { fadeInUp, staggerChildMount } from '@constants/animations'

const PROJECTS = [
  {
    title: 'Maritime Industry Website',
    category: 'Corporate Website',
    description:
      'Corporate website for a major barge fleeting company. Decades in business, needed a site that matched their scale.',
    tech: ['Custom Code', 'Animations', 'Cloud Hosting', 'SEO'],
    metrics: [
      { value: 10, suffix: 'k+', label: 'Monthly Visitors' },
      { value: 95, suffix: '+', label: 'PageSpeed Score' },
      { value: 1, suffix: '', label: 'Google Ranking', prefix: '#' },
    ],
    results: [
      'Professional corporate presence',
      'Mobile-responsive design',
      'Fast page load times',
      'SEO optimized for industry keywords',
    ],
  },
  {
    title: 'Local Restaurant Redesign',
    category: 'Restaurant Website',
    description:
      'Complete website build for a local restaurant that had zero online presence. Now they\'re the top Google result in their area.',
    tech: ['Custom Code', 'Mobile-First', 'SEO', 'Performance'],
    metrics: [
      { value: 1, suffix: '', label: 'Google Ranking', prefix: '#' },
      { value: 40, suffix: '%', label: 'More Reservations' },
      { value: 98, suffix: '', label: 'PageSpeed Score' },
    ],
    results: [
      'Top Google result for local restaurant searches',
      'Mobile-optimized menu and hours',
      'Fast load times on any connection',
      'Online menu with easy updates',
    ],
  },
  {
    title: 'Local Racetrack Website',
    category: 'Entertainment Website',
    description:
      'Full website build for a local dirt track that needed an online home for race schedules, results, and ticket info.',
    tech: ['Custom Code', 'Mobile-First', 'SEO', 'Event Scheduling'],
    metrics: [
      { value: 80, suffix: '%', label: 'More Ticket Sales' },
      { value: 1, suffix: '', label: 'Google Ranking', prefix: '#' },
      { value: 97, suffix: '', label: 'PageSpeed Score' },
    ],
    results: [
      'Race schedules and results updated in real time',
      'Online ticket info and directions',
      'Mobile-optimized for fans in the stands',
      'Top Google result for local racing searches',
    ],
  },
  {
    title: 'Fleet Management Platform',
    category: 'Enterprise Web Platform',
    description:
      'Full-scale internal operations platform for a major industrial company. Fleet tracking, personnel management, reporting, leaderboards, and AI-powered analytics — all custom built.',
    tech: ['Custom Code', 'AI Integration', 'Real-Time Data', 'PWA'],
    metrics: [
      { value: 33, suffix: '.0', label: 'Current Version' },
      { value: 16, suffix: '+', label: 'Modules' },
      { value: 99.9, suffix: '%', label: 'Uptime', decimal: true },
    ],
    results: [
      'Manages 5 fleet asset types across multiple regions',
      'Weekly compliance reporting with AI validation',
      'Real-time dashboards with live data subscriptions',
      'Role-based access for plant managers to executives',
    ],
  },
  {
    title: 'Youth Football Training Camp',
    category: 'Sports & Events Website',
    description:
      'Website for a youth sporting league running football training camps. Registration, schedules, coach bios, and everything parents need in one place.',
    tech: ['Custom Code', 'Mobile-First', 'Registration Forms', 'SEO'],
    metrics: [
      { value: 2, suffix: 'x', label: 'More Signups' },
      { value: 96, suffix: '', label: 'PageSpeed Score' },
      { value: 45, suffix: '%', label: 'More Reach' },
    ],
    results: [
      'Online registration that parents can fill out on their phone',
      'Camp schedules with dates, times, and locations',
      'Coach profiles with credentials and experience',
      'Photo galleries from past camps',
    ],
  },
  {
    title: 'Crawfish Restaurant Website',
    category: 'Restaurant Website',
    description:
      'Full website for a crawfish restaurant with online menu, payment integration, catering info, and everything needed to get hungry customers through the door.',
    tech: ['Custom Code', 'Payment Integration', 'Mobile-First', 'Local SEO'],
    metrics: [
      { value: 55, suffix: '%', label: 'More Orders' },
      { value: 1, suffix: '', label: 'Google Ranking', prefix: '#' },
      { value: 99, suffix: '', label: 'PageSpeed Score' },
    ],
    results: [
      'Online ordering with secure payment processing',
      'Seasonal menu with market-price updates',
      'Catering page with package details and inquiry form',
      'Top result for crawfish restaurant searches locally',
    ],
  },
]

const AGGREGATE_STATS = [
  { value: 100, suffix: '%', label: 'Custom Code' },
  { value: 97, suffix: '+', label: 'Avg. PageSpeed' },
  { value: 99, suffix: '%', label: 'Client Satisfaction' },
  { value: 24, suffix: '/7', label: 'Support' },
]

function AnimatedMetric({ value, suffix = '', prefix = '', label, decimal }) {
  const { count, ref } = useCountUp(decimal ? Math.round(value * 10) : value, 1500)
  const display = decimal ? (count / 10).toFixed(1) : count

  return (
    <div ref={ref} className="rounded-lg bg-blue-50 p-2 text-center">
      <div className="text-lg font-bold text-blue-600">
        {prefix}{display}{suffix}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function StatCard({ value, suffix = '', prefix = '', label }) {
  const { count, ref } = useCountUp(value, 1500)

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl font-bold text-blue-600 sm:text-4xl">
        {prefix}{count}{suffix}
      </div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  )
}

function ProjectCard({ project, index }) {
  return (
    <motion.div
      {...staggerChildMount(index, 0.15)}
      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors duration-300 hover:border-blue-200"
    >
      <div className="p-8">
        <div className="mb-4 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {project.category}
        </div>
        <h3 className="mb-3 text-2xl font-semibold text-gray-900">{project.title}</h3>
        <p className="mb-5 text-gray-600">{project.description}</p>

        <div className="mb-5 grid grid-cols-3 gap-3">
          {project.metrics.map(metric => (
            <AnimatedMetric key={metric.label} {...metric} />
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {project.tech.map(tech => (
            <span
              key={tech}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
            >
              {tech}
            </span>
          ))}
        </div>

        <ul className="space-y-2">
          {project.results.map(result => (
            <li key={result} className="flex items-start gap-3 text-sm text-gray-600">
              <Check
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
                strokeWidth={2}
              />
              {result}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

export default function Work() {
  return (
    <div>
      <Seo
        title="Our Work"
        description="See how TaylorURL has helped businesses grow with custom websites. Real projects, real results."
        path="/work"
      />
      <PageHero
        title="Our Work"
        description="Real websites we've built for real businesses. No templates. No page builders. Just clean, custom code that actually works."
      />

      {/* Results at a Glance */}
      <section className="border-b border-gray-200 bg-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp}>
            <p className="mb-8 text-center text-sm font-semibold uppercase tracking-wider text-gray-400">
              Results at a Glance
            </p>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {AGGREGATE_STATS.map((stat, i) => (
                <motion.div key={stat.label} {...staggerChildMount(i, 0.1)}>
                  <StatCard {...stat} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Projects */}
      <section className="relative bg-white py-20 overflow-hidden">
        <div className="grid-pattern absolute inset-0 opacity-[0.015]" />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            {PROJECTS.map((project, i) => (
              <ProjectCard key={project.title} project={project} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gray-950 py-20">
        <div className="grid-pattern-blue absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...fadeInUp} className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">
              Like what you <span className="logo-wave">see?</span>
            </h2>
            <p className="mb-8 text-lg text-gray-400">
              We keep things simple. You tell us what you need, we build it, and your business grows. No contracts, no nonsense.
            </p>
            <Link
              to="/pricing"
              className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-blue-500"
            >
              Let's Talk
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
