import { m } from 'framer-motion'
import { Clock, MessageSquare, PhoneCall, ShieldCheck } from 'lucide-react'
import { DRAFTS } from '@constants/drafting'
import PageHero from '@components/page-bands/PageHero'
import CtaSection from '@components/conversion/CtaSection'
import Mesh from '@components/mesh/Mesh'
import Seo from '@components/Seo'
import { fadeInUp, staggerChild } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'
import { breadcrumbSchema } from '@constants/seo'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, SUPPORT_EMAIL } from '@constants/navigation'
import { BIO_TEXT, BIO_TITLE } from '@lib/mail/bio.js'

const BAND = GROUNDS.band

const TRAITS = [
  {
    icon: Clock,
    title: 'Open when the question is',
    description:
      'The question usually comes to you after the shop has closed. The assistant is there then, and the answer does not wait until Monday.',
  },
  {
    icon: MessageSquare,
    title: 'It knows the work',
    description:
      'What a build involves, what is included after it launches, who the sites are for, how the domain stays in your name. Ask it plainly and it answers plainly.',
  },
  {
    icon: PhoneCall,
    title: 'It hands you over',
    description:
      'Anything about your specific shop, your timeline or your number goes to Trenton. Leave an address in the box and it reaches him while you are still on the page.',
  },
  {
    icon: ShieldCheck,
    title: 'It stays in its lane',
    description:
      'It will not quote you a price it cannot stand behind, promise a date, or talk about anybody else it has worked with. When it does not know, it says so.',
  },
]

export default function Live() {
  return (
    <div>
      <Seo
        title="Live: Ask About Your Site Any Time"
        description="An assistant on hand day and night to answer questions about a custom website from TaylorURL, and to put you in front of Trenton Taylor when you want a number."
        path="/live"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Live', path: '/live' },
          ]),
        ]}
      />

      <PageHero
        draft="column"
        eyebrow="Live"
        title="Ask now, not on Monday."
        description="There is an assistant in the corner of every page here. It answers questions about the work at whatever hour you thought of them, and it puts you in front of Trenton when the answer needs a person."
      />

      <section className="section-y relative overflow-hidden bg-paper">
        <div
          className={`absolute inset-0 ${GROUNDS.paper.grid} ${DRAFTS.node}`}
          aria-hidden="true"
        />
        <div className="container-rail relative">
          <m.div {...fadeInUp} className="flex max-w-[820px] flex-col gap-6">
            <p className="section-label text-accent">Who You Are Reaching</p>
            <h2 className="display-3 font-semibold leading-[1.04] tracking-tightest text-ink-paper [text-wrap:balance]">
              The assistant answers first. Trenton answers next.
            </h2>

            <div className="flex flex-col gap-6 pt-2 sm:flex-row sm:items-start sm:gap-8">
              <img
                src="/images/trenton-taylor.webp"
                srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
                alt=""
                width="96"
                height="96"
                loading="lazy"
                className="border-hair-paper-strong h-24 w-24 shrink-0 rounded-md border object-cover"
              />
              <div className="space-y-4 text-[17px] leading-relaxed text-paper-soft">
                <p>
                  <span className="font-semibold text-ink-paper">Trenton Taylor</span>, {BIO_TITLE}.{' '}
                  {BIO_TEXT}
                </p>
                <p>
                  The assistant knows what he builds and how he works, and it is honest about the
                  edge of what it knows. Anything about your shop specifically is his to answer:
                  what it would take, what it would cost, when it could start. Getting you to him is
                  the whole reason the box is there.
                </p>
                <p className="text-[15px]">
                  Straight to him:{' '}
                  <a className="accent-underline text-accent" href={`mailto:${SUPPORT_EMAIL}`}>
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  ·{' '}
                  <a className="accent-underline text-accent" href={COMPANY_PHONE_HREF}>
                    {COMPANY_PHONE}
                  </a>
                </p>
              </div>
            </div>
          </m.div>
        </div>
      </section>

      <section
        data-ground="band"
        className="border-hair section-y relative overflow-hidden border-t bg-bg text-ink"
      >
        <div className={`absolute inset-0 ${GROUNDS.band.grid} ${DRAFTS.iso}`} aria-hidden="true" />
        <div className="container-rail relative">
          <m.div {...fadeInUp} className="flex max-w-[820px] flex-col gap-5">
            <p className="section-label text-accent">What It Does</p>
            <h2 className="display-4 font-semibold leading-[1.06] tracking-tightest [text-wrap:balance]">
              A straight answer, or the person who has one.
            </h2>
          </m.div>

          <Mesh
            items={TRAITS}
            ground="band"
            columns={{ base: 1, sm: 2 }}
            scale="card"
            as="ul"
            className="mt-12"
          >
            {(trait, index, cell) => (
              <m.li
                key={trait.title}
                {...staggerChild(index)}
                className={`flex flex-col gap-3 p-6 sm:p-7 ${BAND.surface} ${cell}`}
              >
                <trait.icon className="h-5 w-5 text-accent" strokeWidth={1.5} aria-hidden="true" />
                <h3 className={`text-[16px] font-semibold tracking-tight ${BAND.title}`}>
                  {trait.title}
                </h3>
                <p className={`text-[14px] leading-relaxed ${BAND.body}`}>{trait.description}</p>
              </m.li>
            )}
          </Mesh>
        </div>
      </section>

      <CtaSection
        draft="ledger"
        ground="paper"
        eyebrow="When You Are Ready"
        title={
          <>
            Tell him what the business does and what has to{' '}
            <span className="text-accent">change</span>.
          </>
        }
        description="The chat is the quick way in. The contact page is the one to use when you would rather write it all out at once."
      />
    </div>
  )
}
