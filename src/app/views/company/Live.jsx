import { CallToAction, Grid, PageIntro, Section, SectionHead } from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import { COMPANY_PHONE, COMPANY_PHONE_HREF, SUPPORT_EMAIL } from '@constants/navigation'

const TRAITS = [
  {
    title: 'Open when the question is',
    body: 'The question usually comes to you after the shop has closed. The assistant is there then, and the answer does not wait until Monday.',
  },
  {
    title: 'It knows the work',
    body: 'What a build involves, what is included after it launches, who the sites are for, how the domain stays in your name. Ask it plainly and it answers plainly.',
  },
  {
    title: 'It hands you over',
    body: 'Anything about your specific shop, your timeline or your number goes to me. Leave an address in the box and it reaches me while you are still on the page.',
  },
  {
    title: 'It stays in its lane',
    body: 'It will not quote you a price it cannot stand behind, promise a date, or talk about anybody else it has worked with. When it does not know, it says so.',
  },
]

const LINK = 'text-[color:var(--link)] underline underline-offset-[3px] hover:text-ink'

/**
 * The assistant's page.
 *
 * The chat itself is mounted by the layout, which opens it on arrival here
 * wherever it is a panel rather than a sheet over the page. This page says who
 * is answering - the assistant first, Trenton next - what it can and cannot
 * answer, and how to skip it.
 */
export default function Live() {
  return (
    <>
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

      <PageIntro
        title="The assistant answers first. I answer next."
        lead="The assistant in the corner of every page answers at any hour, and hands you to me when the answer needs a person."
      />

      <Section label="What it can answer" className="!pt-6">
        <SectionHead title="What it can answer" />
        <Grid cols={2}>
          {TRAITS.map(trait => (
            <div key={trait.title} className={`${CARD} p-6 sm:p-7`}>
              <h3 className={TYPE.h3}>{trait.title}</h3>
              <p className={`${TYPE.body} mt-2`}>{trait.body}</p>
            </div>
          ))}
        </Grid>
        <p className={`${TYPE.body} mt-8`}>
          Straight to me:{' '}
          <a className={LINK} href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{' '}
          or{' '}
          <a className={`${LINK} whitespace-nowrap`} href={COMPANY_PHONE_HREF}>
            {COMPANY_PHONE}
          </a>
          .
        </p>
      </Section>

      <CallToAction title="Tell me what the business does and what has to change." />
    </>
  )
}
