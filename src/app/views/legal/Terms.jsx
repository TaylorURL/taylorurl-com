import LegalPage from '@components/page-bands/LegalPage'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import { BRAND_NAME, COMPANY_LOCATION, COMPANY_PHONE, SUPPORT_EMAIL } from '@constants/navigation'
import { TERMS as SECOND_SITE } from '@data/taylorwebsite/legalTaylorwebsite'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// How long a site stays up after a payment fails before anything is switched
// off. It is written here rather than left to a judgement call, because a
// shop whose site can disappear on an unstated timetable cannot plan around
// it, and because a term that protects a client only when somebody remembers
// to apply it is not a term.
const GRACE_DAYS = 10

const SECTIONS = [
  {
    title: 'Acceptance Of These Terms',
    content: `Using this website, or engaging us to build or look after a site, means you accept these terms. If you do not accept them, do not use our services. Where a signed project agreement, statement of work or checkout page says something different from this page, that document governs for that project and these terms cover everything it does not.`,
  },
  {
    title: 'Who You Are Contracting With',
    content: `These terms are between you and ${BRAND_NAME}, a Texas limited liability company working from ${COMPANY_LOCATION}. The company is the party to this agreement, and it is the company you are engaging, paying and holding to these terms.

These pages are written as "we" because the company is what answers: whoever on its side carries out the work, every obligation and every liability on this page is the company's.

The work is carried out from Baytown and reaches clients across Southeast Texas and beyond; there is no premises where visitors are received, which is why the address given is an area rather than a street. You can reach a person on ${COMPANY_PHONE} or at ${SUPPORT_EMAIL}.`,
  },
  {
    title: 'What We Provide',
    content: `Custom website design and build, online booking and customer tools, redesigns of existing sites, business email set-up, help with being found in local search, and the hosting, monitoring and maintenance that keep a site published. All of it is provided by the company and carried out by the team working on your project.

The scope, deliverables, timeline and price for your project are set out in your own project agreement or on the checkout page you bought from. Anything outside that scope is new work and is quoted before it is started, never added to an invoice afterwards.`,
  },
  {
    title: 'What You Are Responsible For',
    content: `Giving us the text, images, logos and access we need to do the work; answering questions and reviewing drafts in reasonable time; making sure the information you give us about your business is accurate; and paying on the terms agreed.

A project runs on the slower of the two of us. Where materials or approvals are outstanding, the timeline moves by the time it takes to get them, and we will say so at the time rather than at the end.`,
  },
  {
    title: 'Your Content And The Rights To It',
    content: `You keep everything you supply. You also confirm, by supplying it, that you are entitled to: that the photographs are yours or licensed, that the logo is yours to use, that the text is not copied from a competitor, and that nothing you hand over infringes anyone's rights or breaks any law.

This matters more than it sounds. A stock photograph used without a license is a bill that arrives eighteen months later, and it arrives at whoever published it. If a claim is made against us because of material you supplied or instructed us to publish, you cover the cost of dealing with it. If we are the ones who put something on your site without a license, that is ours to fix and ours to pay for.`,
  },
  {
    title: 'Payment Terms',
    content: `A build is charged once, before the work begins. The monthly fee is charged to the same card on the same day each month and continues automatically until you cancel it. There is no annual term and no minimum period. If the monthly fee changes, you are told in writing at least 30 days before the new figure is charged, and you can cancel before it takes effect.

The monthly fee is what pays for hosting, monitoring, maintenance and the ongoing work that keeps a site published. It is a condition of the site staying online rather than an optional extra, and it runs for as long as the site is published. Charges for things bought on your behalf, such as a domain name, a paid integration or advertising spend, are passed through at cost and shown separately.

Where you bought through the checkout on this site, the figures shown there are the terms: the one-off build fee, the monthly fee, and the day of the month it recurs.`,
  },
  {
    title: 'Late Payment And Suspension',
    content: `If a monthly payment fails, the card is retried and you are emailed. A site is not taken offline the same day: you have ${GRACE_DAYS} days from the first failed payment to put it right, and you will hear from us inside that window rather than discover it from your customers.

After that the site may be suspended until the account is current. Suspension is not deletion. Your data and your domain are untouched, and the site goes back up when the payment does.`,
  },
  {
    title: 'Cancellation And Refunds',
    content: `The monthly fee runs month to month. There is no cancellation fee and no notice period. To stop it, write to ${SUPPORT_EMAIL}; there is no form to find and no retention call to sit through. Billing stops when the subscription is cancelled, the site stays up until the end of the period you have already paid for, and it comes offline at the end of it, because the monthly fee is what keeps it hosted.

Your domain stays yours to transfer anywhere. The content you supplied stays yours to take, and we will give you a copy whatever the reason for leaving.

The build fee pays for the work carried out. Where a project ends before the site goes live, whether that fee is refunded in whole or in part depends on how much of the build has been done. We will put the calculation in writing before anything is settled, so you can see the reasoning rather than just the figure.`,
  },
  {
    title: 'Ownership',
    content: `You own your domain name, your content, your brand marks, your customer records, and anything you write into the site after launch. The domain is registered in your name and you may move it to another registrar or provider at any time, for any reason or none.

We own the source code behind the site and the platform it is built and served on. That is licensed to you for as long as the monthly fee is current, and the terms of that license are set out on the License page. Ending the arrangement ends the license; it does not touch anything in the paragraph above.

We may show completed work in our portfolio and case studies unless you ask us not to, and asking costs nothing.`,
  },
  {
    title: 'Your Customers’ Data',
    content: `A site we build for you may collect information about your customers: bookings, enquiries, orders, mailing lists, visit measurements. That information is yours. We hold it on your behalf and on your instructions, use it only to run and support your site, and never for anything of our own.

We do not sell it, share it, or add it to a list of our own. You can have a copy at any time. If a customer of yours asks us about their data we will pass the request to you rather than act on it, because it is your decision to make. If we become aware of a breach affecting it, you will hear from us promptly and with what we know, so that you can meet your own obligations to your customers. The Privacy page sets this out in full.`,
  },
  {
    title: 'Acceptable Use',
    content: `A site we build and host may not be used to break the law, to infringe someone else's rights, to send unsolicited bulk email, to distribute malware, to publish material that is defamatory or obscene, or to deceive the people it is shown to.

If a site crosses one of those lines we will tell you what the problem is and give you a fair chance to fix it. Where the breach is one that cannot wait, because it is causing harm or exposing us or our other clients to liability, the site may come down first and be discussed second.`,
  },
  {
    title: 'Third-Party Services',
    content: `Some of what your site depends on is not ours: the domain registrar, the payment processor, the email provider, mapping and search services, and any integration you have asked for. Each has its own terms and its own uptime, and we pick them on the same basis we would for our own work.

Where one of them fails, changes its pricing, or withdraws a feature, we will tell you and find the best way through it. We cannot be responsible for the acts of a company we do not run, and we will not pretend the choice was not ours either.`,
  },
  {
    title: 'Backups And Restores',
    content: `Sites and their data are backed up as part of the monthly fee, and a restore is part of the service rather than an extra. Backups are a safety net and not an archive: they exist to bring a site back after a failure, not to recover a page you deleted two years ago. If something matters to you long term, keep your own copy, and ask us if you would like help setting that up.`,
  },
  {
    title: 'Accessibility',
    content: `We build to recognized web accessibility guidance, because a site that a customer using a screen reader or a keyboard cannot use is a site turning away business, and because the law increasingly expects it. That is a standard we work to and not a certification we can grant.

Accessibility is also a moving target once a site is live: content you add afterwards, a third-party widget, or an untagged image can undo it. Tell us if you find something on your site that is hard to use and we will fix it.`,
  },
  {
    title: 'Confidentiality',
    content: `Both of us keep the other's confidential information to ourselves. That covers business plans, figures, customer lists, technical detail about how the platform works, and anything marked confidential or obviously meant to be. It does not cover anything already public, anything either of us knew beforehand, or anything a court or regulator requires to be disclosed.`,
  },
  {
    title: 'What We Do Not Promise',
    content: `Services are provided as they are, without warranties of any kind beyond what your project agreement sets out.

In particular: we do not guarantee a position in Google or any other search engine, and nobody honestly can. Rankings are decided by Google against criteria it changes without notice, and any promise of a particular place on a results page is a promise the person making it cannot keep. What we will do is the work that gives a site its best chance, and show you what actually happened.

We do not guarantee a particular volume of enquiries, sales or revenue. We do not guarantee that a site will be uninterrupted or free of faults, though it is monitored around the clock and problems are worked as they are found.`,
  },
  {
    title: 'Who Is Liable',
    content: `Every obligation on this page is ${BRAND_NAME}'s, and a claim arising out of the work or out of these terms lies against the company. Under the Texas Business Organizations Code, the member and manager of a Texas limited liability company is not personally liable for the debts, obligations or liabilities of the company, and nothing in these terms or in any project agreement changes that.

So a claim is made against the company, not against Trenton Taylor personally, and not against anyone else working on the company's behalf. This is not a way of putting a problem out of reach: the company is the thing you engaged, it is the thing that answers, and the complaints route below reaches the same person either way.`,
  },
  {
    title: 'Limitation Of Liability',
    content: `Neither of us is liable to the other for indirect, incidental, special, consequential or punitive damages, or for lost profits, lost revenue or lost data, arising out of this arrangement.

The company's total liability for any claim is limited to the fees you paid it in the twelve months before the claim arose. Where a limit or exclusion in this section is capable of protecting the company, it protects its member, manager, employees and contractors on the same terms.

Nothing in these terms limits liability for fraud, for wilful misconduct, or for anything else that cannot lawfully be limited.`,
  },
  {
    title: 'Indemnity',
    content: `You agree to cover the company's reasonable costs, including legal costs, arising from a third-party claim caused by material you supplied, by instructions you gave us, or by your use of a site in breach of the acceptable use section above. That cover extends to the company's member, manager, employees and contractors. The company agrees to do the same for you where a claim arises from its own infringement or its own breach of these terms.`,
  },
  {
    title: 'Termination',
    content: `Either of us may end the arrangement with written notice. You are responsible for payment for work completed up to that date, and deposits or advance payments may be non-refundable depending on the work already done, as set out under cancellation above.

Because the monthly fee is what keeps a site hosted and maintained, the site is taken offline when that fee ends. You keep your domain name and may transfer it out, and you keep the content you supplied; ask and we will give you a copy. The source code and the platform stay with ${BRAND_NAME}.`,
  },
  {
    title: 'Events Outside Our Control',
    content: `Neither of us is in breach for a delay or a failure caused by something genuinely outside our control: a hosting or network outage upstream, a hurricane, a power failure, a strike, an act of government, or a serious illness. Where one of those things happens we will tell you as soon as we know, say what we are doing about it, and get back to normal as quickly as we can.`,
  },
  {
    title: 'Complaints',
    content: `If something is wrong, say so and it gets dealt with. Write to ${SUPPORT_EMAIL} or call ${COMPANY_PHONE}, and you will have an acknowledgement within one business day and an answer or a plan within five.

Raising a complaint costs you nothing and does not affect your site or your billing while it is being looked at. If we cannot settle it between us, you are free to take it to any consumer body or court with jurisdiction, and nothing in these terms is intended to remove a right you have under Texas or federal law.`,
  },
  {
    title: 'Changes To These Terms',
    content: `These terms may change. A change that affects what you pay, what you own, or how either of us may end the arrangement is a material change, and existing clients are told about one by email at least thirty days before it takes effect, so nobody is bound by a term they were never shown. Corrections that do not change the substance take effect when they are posted here, and the effective date at the top moves with them. Continuing to use our services after a change takes effect is acceptance of it.`,
  },
  {
    title: 'Governing Law',
    content: `These terms are governed by the laws of the State of Texas, without regard to its conflict of law provisions. Where a dispute cannot be settled between us or through the complaints route above, it is to be resolved in the courts of Harris County, Texas.

Nothing here waives or limits a right you have under Texas or federal consumer protection law, including the Texas Deceptive Trade Practices Act, and any term on this page that would have that effect does not apply to you.`,
  },
  {
    title: 'General',
    content: `If any part of these terms is found to be unenforceable, the rest stands. Not enforcing a term on one occasion is not a waiver of it. Neither of us may transfer this arrangement to somebody else without the other's written agreement, except that we may transfer it as part of a sale of the whole business, on the same terms. Notices under these terms are given in writing by email to the addresses each of us uses for the work.

These terms, together with your project agreement, the Privacy page and the License page, are the whole of the arrangement between us, and they replace anything said before them.`,
  },
]

/**
 * The studio's own answers, in the shape the second site's record already takes.
 *
 * Gathered here rather than left inline so one page renders both sites. The
 * words are untouched and stay in this file; see the note on the same object in
 * Privacy.jsx for why they do not move.
 */
const STUDIO = {
  seoTitle: 'Terms of Service',
  seoDescription:
    'The terms for working with TaylorURL LLC: what the build covers, what the monthly fee pays for, who owns what, how to cancel, and how a complaint is handled.',
  title: 'Terms of Service',
  description:
    'The arrangement between you and us: what we build, what it costs, who owns what, and how either of us can end it.',
  eyebrow: 'Terms',
  effectiveDate: 'September 4, 2026',
  appliesTo: 'Clients and visitors to taylorurl.com',
  summary: [
    'Your agreement is with TaylorURL LLC, a Texas limited liability company. The company is what you engage and what answers.',
    'The build is charged once. The monthly fee recurs on the same day each month until you cancel, and it is what keeps the site online.',
    'Cancel by email whenever you like. No annual term, no cancellation fee, no retention call.',
    'You own your domain, your content and your customer records. We own the code and the platform, licensed to you while the fee is current.',
    'A failed payment gives you ' +
      GRACE_DAYS +
      ' days and an email before anything is switched off.',
    'Your customers’ data is yours. We hold it on your instructions and never use it for anything of our own.',
    'We do not guarantee search rankings, and nobody honestly can. We guarantee the work.',
    'Complaints are acknowledged in one business day and answered within five.',
  ],
  introText: undefined,
  sections: SECTIONS,
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

export default function Terms() {
  return (
    <>
      <Seo
        title={DOC.seoTitle}
        description={DOC.seoDescription}
        path="/terms"
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Terms of Service', path: '/terms' },
        ])}
      />
      <LegalPage
        {...DOC}
        footer={{
          heading: 'Questions About These Terms',
          body: (
            <>
              Ask before you sign rather than after. Write to{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-accent underline transition-colors duration-200 hover:text-[color:var(--accent-hi)]"
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              or call {COMPANY_PHONE}, and the people who answer are the people who do the work.
            </>
          ),
        }}
      />
    </>
  )
}
