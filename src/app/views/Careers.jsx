import { motion } from 'framer-motion'
import { Check, Code2, GraduationCap, Laptop, Mail, TrendingUp } from 'lucide-react'
import Seo from '@components/Seo'
import PageHero from '@components/PageHero'
import { fadeInUp, staggerChild } from '@constants/animations'
import { SUPPORT_EMAIL } from '@constants/navigation'

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

      {/* Why Work With Us */}
      <section className="bg-white px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeInUp} transition={{ duration: 0.5 }} className="mb-14 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Why Work With Us
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              We believe great work comes from great teams. Here&apos;s what makes TaylorURL a place
              you&apos;ll love.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <motion.div
                  key={benefit.title}
                  {...staggerChild(index)}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{benefit.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{benefit.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="bg-gray-50 px-4 py-20 sm:px-6 md:py-28">
        <div className="mx-auto max-w-4xl">
          <motion.div {...fadeInUp} transition={{ duration: 0.5 }} className="mb-14 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Open Positions
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              We&apos;re looking for talented developers to join our growing team.
            </p>
          </motion.div>

          <div className="space-y-8">
            {POSITIONS.map((position, index) => (
              <motion.div
                key={position.title}
                {...staggerChild(index)}
                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
              >
                <h3 className="mb-3 text-2xl font-bold text-gray-900">{position.title}</h3>
                <div className="mb-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                    {position.type}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {position.location}
                  </span>
                </div>
                <p className="mb-6 leading-relaxed text-gray-600">{position.description}</p>

                <div className="mb-6">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">Requirements</h4>
                  <ul className="space-y-2">
                    {position.requirements.map(req => (
                      <li key={req} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-8">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">Nice to Have</h4>
                  <ul className="space-y-2">
                    {position.niceToHave.map(item => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Application: ${position.title}`)}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <Mail className="h-4 w-4" />
                  Apply Now
                </a>
              </motion.div>
            ))}
          </div>

          {/* General Application */}
          <motion.div
            {...fadeInUp}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
          >
            <p className="mb-4 text-gray-600">
              Don&apos;t see your role? We&apos;re always interested in hearing from talented
              developers.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('General Application')}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              <Mail className="h-4 w-4" />
              Send us your resume
            </a>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 px-4 py-20 sm:px-6 md:py-28">
        <motion.div
          {...fadeInUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to <span className="logo-wave">Join Us?</span>
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-gray-400">
            Send us your resume and portfolio. We&apos;d love to hear from you.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Career Inquiry')}`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Mail className="h-5 w-5" />
            Apply Now
          </a>
        </motion.div>
      </section>
    </>
  )
}
