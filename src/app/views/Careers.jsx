import { motion } from 'framer-motion'
import { Check, Code2, GraduationCap, Laptop, Mail, TrendingUp } from 'lucide-react'
import Seo from '@components/Seo'
import PageHero from '@components/PageHero'
import { fadeInUp, staggerChild } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'
import {
  BADGE,
  BADGE_BLUE,
  BTN_PRIMARY_LG,
  BTN_PRIMARY_SM,
  SECTION_H2,
  SECTION_H2_DARK,
} from '@constants/ui'

const FADE_DURATION = 0.5
const GENERAL_APPLICATION_DELAY = 0.2

const BENEFITS = [
  {
    icon: Laptop,
    title: 'Flexible Remote Work',
    description: "Work from anywhere. We're a remote-first team based in Baytown, TX.",
  },
  {
    icon: Code2,
    title: 'Modern Tech Stack',
    description: 'Build with React, Java, and cutting-edge tools every day.',
  },
  {
    icon: TrendingUp,
    title: 'Real Impact',
    description: 'See your work directly help local businesses grow and succeed.',
  },
  {
    icon: GraduationCap,
    title: 'Growth & Learning',
    description: 'Continuous learning opportunities and mentorship.',
  },
]

const POSITIONS = [
  {
    title: 'Full-Stack Web Developer',
    type: 'Full-Time / Contract',
    location: 'Remote (Baytown, TX preferred)',
    description:
      'We are looking for a skilled web developer to join our team and help build and manage websites for local businesses.',
    requirements: [
      'Proficient in JavaScript and Java',
      'Experience with React and modern frontend frameworks',
      'Understanding of RESTful APIs and backend development',
      'Familiarity with databases (SQL and/or NoSQL)',
      'Strong problem-solving skills and attention to detail',
      'Ability to work independently and communicate clearly',
    ],
    niceToHave: [
      'Experience with Tailwind CSS',
      'Knowledge of cloud services (AWS, Vercel, etc.)',
      'Experience with CI/CD pipelines',
      'Portfolio of previous web development work',
    ],
  },
]

function buildMailtoHref(subject) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

function CheckList({ items, iconColor = 'text-blue-600' }) {
  return (
    <ul className="space-y-2">
      {items.map(label => (
        <li key={label} className="flex items-start gap-2.5 text-sm text-gray-600">
          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Careers() {
  return (
    <>
      <Seo
        title="Careers"
        description="Join the TaylorURL team. We're hiring web developers proficient in Java and JavaScript to help local businesses succeed online."
        path="/careers"
      />

      <PageHero
        title="Careers"
        description="Join our team and help local businesses succeed online."
      />

      <section className="bg-surface-base px-4 py-12 sm:px-6 sm:py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            {...fadeInUp}
            transition={{ duration: FADE_DURATION }}
            className="mb-14 text-center"
          >
            <h2 className={`mb-4 ${SECTION_H2}`}>Why Work With Us</h2>
            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-lg">
              We believe great work comes from great teams. Here&apos;s what makes TaylorURL a place
              you&apos;ll love.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                {...staggerChild(index)}
                className="rounded-2xl border border-gray-200 bg-surface-raised p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-20 md:py-28">
        <div className="mx-auto max-w-4xl">
          <motion.div
            {...fadeInUp}
            transition={{ duration: FADE_DURATION }}
            className="mb-14 text-center"
          >
            <h2 className={`mb-4 ${SECTION_H2}`}>Open Positions</h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              We&apos;re looking for talented developers to join our growing team.
            </p>
          </motion.div>

          <div className="space-y-8">
            {POSITIONS.map((position, index) => (
              <motion.div
                key={position.title}
                {...staggerChild(index)}
                className="rounded-2xl border border-gray-200 bg-surface-overlay p-5 shadow-sm sm:p-8"
              >
                <h3 className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">
                  {position.title}
                </h3>
                <div className="mb-5 flex flex-wrap gap-2">
                  <span className={BADGE_BLUE}>{position.type}</span>
                  <span className={BADGE}>{position.location}</span>
                </div>
                <p className="mb-6 leading-relaxed text-gray-600">{position.description}</p>

                <div className="mb-6">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">Requirements</h4>
                  <CheckList items={position.requirements} />
                </div>

                <div className="mb-8">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">Nice to Have</h4>
                  <CheckList items={position.niceToHave} iconColor="text-gray-400" />
                </div>

                <a
                  href={buildMailtoHref(`Application: ${position.title}`)}
                  className={BTN_PRIMARY_SM}
                >
                  <Mail className="h-4 w-4" />
                  Apply Now
                </a>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...fadeInUp}
            transition={{ duration: FADE_DURATION, delay: GENERAL_APPLICATION_DELAY }}
            className="mt-8 rounded-2xl border border-gray-200 bg-surface-overlay p-5 text-center shadow-sm sm:p-8"
          >
            <p className="mb-4 text-gray-600">
              Don&apos;t see your role? We&apos;re always interested in hearing from talented
              developers.
            </p>
            <a
              href={buildMailtoHref('General Application')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              <Mail className="h-4 w-4" />
              Send us your resume
            </a>
          </motion.div>
        </div>
      </section>

      <section className="bg-gray-900 px-4 py-12 sm:px-6 sm:py-20 md:py-28">
        <motion.div
          {...fadeInUp}
          transition={{ duration: FADE_DURATION }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className={`mb-4 ${SECTION_H2_DARK}`}>
            Ready to <span className="logo-wave">Join Us?</span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-base text-gray-400 sm:text-lg">
            Send us your resume and portfolio. We&apos;d love to hear from you.
          </p>
          <a href={buildMailtoHref('Career Inquiry')} className={BTN_PRIMARY_LG}>
            <Mail className="h-5 w-5" />
            Apply Now
          </a>
        </motion.div>
      </section>
    </>
  )
}
