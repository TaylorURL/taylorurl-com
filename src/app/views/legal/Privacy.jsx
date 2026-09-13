import LegalPage from '@components/page-bands/LegalPage'
import Seo from '@components/Seo'
import { breadcrumbSchema } from '@constants/seo'
import { BRAND_NAME, COMPANY_PHONE, SUPPORT_EMAIL } from '@constants/navigation'
import { PRIVACY as SECOND_SITE } from '@data/taylorwebsite/legalTaylorwebsite'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// The two hats, and the reason this page opens on them. Everything on
// taylorurl.com is collected by us and answers to us. Everything on a site
// built for a client - a booking, an enquiry, a customer record - belongs to
// that client and is only held on their instructions, and a policy that blurs
// the two tells a shop's customer to write to the wrong person about their own
// data. It is the first section for that reason.
const SECTIONS = [
  {
    title: 'Who This Covers',
    content: `This policy covers two different things and it is worth separating them at the top.

On taylorurl.com, we decide what is collected and why, and we answer for it. If you filled in a form here, opened the chat, or simply read a page, this policy is the whole answer and you can write to us directly.

On a website we built for a client, the client decides what is collected and why. Their bookings, enquiries, customer records and mailing lists are theirs. We hold that information for them, on their instructions, so that their site works and stays online, and we do not use it for anything of our own. If you are a customer of one of those businesses, they are the people to ask about your data, and their own privacy notice governs it. Write to us and we will pass the request to them rather than act on it ourselves.`,
  },
  {
    title: 'What We Collect On This Site',
    content: `Only what the site needs to do its job, and no more than that.

What you hand over: your name, email address, phone number, business name, and whatever else you choose to put in a contact form, a project enquiry, a speed check or the chat. If you buy through the checkout, the details needed to raise and keep the subscription. A form is recorded as it is filled in rather than only when it is sent, so an address typed into one is kept whether or not you press the button underneath it.

What a visit produces on its own: the page you were on, the address you arrived from, any campaign tags in the link, your browser, operating system and device type, your language, your screen and window size, an approximate location down to the town, how long you stayed, and a random identifier used to tell one visit from the next. Your IP address is read to work out that approximate location and is not kept in the record.

If a page throws an error in your browser, the error and the address it happened on are reported to us so we can fix it. Those reports carry the fault, not you.`,
  },
  {
    title: 'What We Collect For A Client',
    content: `A site we build usually carries the same visit measurements described above, so the owner can see how many people came and where from, and it carries whatever the business itself asks for: a booking, a quote request, a message, an order.

That information is the business's, not ours. We do not sell it, mine it, add it to a mailing list of our own, or use it to sell anything to anybody. We keep it available and backed up for as long as the business is a client, and we hand it over on request. When a client leaves, they take it with them, and what remains on our systems is deleted once they confirm they have it.`,
  },
  {
    title: 'How The Information Is Used',
    content: `To answer you, to quote and carry out work, to raise and collect payment for it, to keep sites online and fix them when they break, to understand which pages and which advertising are worth keeping, and to meet legal and accounting obligations.

It is not used to make an automated decision about you, and it is not used for anything we have not named here.`,
  },
  {
    title: 'Cookies, Analytics And Advertising',
    content: `This site runs Google Analytics, Google Ads conversion tracking and the Meta advertising pixel. All three set cookies or similar identifiers and all three are third parties with privacy policies of their own. Google Analytics tells us how many people read a page and how they found it. Google Ads records that an advertisement led to a message or a call, so we can tell which advertising is worth paying for. The Meta pixel counts the same visits for advertising. Under Texas law the two advertising ones count as processing for targeted advertising.

They load after the page is usable, except on a visit that arrived from an advertisement, where they load straight away: what identifies the click is written on the address you arrived at and is gone as soon as you open a second page.

When you send a form, the name, email address and phone number you typed are also turned into one-way fingerprints in your browser and sent to Google with the record of the conversion, so it can tell that the person who wrote in is the person who clicked. Your details themselves never reach Google, a fingerprint cannot be turned back into them, and Google discards any that do not match an account it already holds.

You can stop all of it. Refuse or delete cookies in your browser settings, use a blocker, or turn on Global Privacy Control, which several browsers and extensions offer as a single switch. Where your browser sends that signal we treat it as an opt out of targeted advertising and will not argue with it. You can also write to ${SUPPORT_EMAIL} and ask, and it will be honoured the same way.

Turning any of this off does not change what the site does for you. Nothing here is behind a cookie wall and no page is withheld from anyone who declines.`,
  },
  {
    title: 'Who The Information Is Shared With',
    content: `We do not sell personal information, we do not trade it, and we do not hand it to anyone for money.

It reaches the companies that run the machinery behind this business and no further: Vercel, which serves the site; Supabase, which holds the database and runs the background jobs; Stripe, which takes payments; Resend, which delivers email; Google and Meta, as described above; and Trustpilot, where reviews are collected. Each is bound to use what it holds only to provide that service.

Beyond those, information is disclosed only where the law requires it, where it is needed to establish or defend a legal claim, where it is needed to protect somebody's safety, or to a buyer as part of a sale of the business, in which case this policy follows it.`,
  },
  {
    title: 'Payments',
    content: `Card details never reach us. Checkout and every recurring charge run through Stripe, which is a certified payment processor, and what comes back to us is the last four digits, the card brand, and whether the payment worked. There is nowhere on our systems where a full card number is stored, because there is nowhere it has ever been.`,
  },
  {
    title: 'Email And Messages',
    content: `Email about a project, an invoice, an outage or a reply to something you sent is service email rather than marketing, and it continues while you are a client whatever your marketing preferences are.

Every message we send that is not service email carries an unsubscribe link that works in one click and without signing in, and unsubscribing takes effect immediately across every list we send from.

If you start a quote here, leave an address and do not finish, you may get one message from us asking whether you found what you needed. One message, not a sequence, and it carries the same one-click unsubscribe every other message does. Unsubscribing stops it and everything else.

The chat on this site is answered by an assistant, with a way through to us when the answer needs a person. What you type there is kept so a conversation can be picked up again and so we can see where the answers were wrong. Do not put card numbers, passwords or anything else sensitive into it.`,
  },
  {
    title: 'How Long It Is Kept',
    content: `Enquiries and messages are kept for two years from the last contact, so that a conversation picked up again a year later still makes sense. Where you have asked us to stop writing, the record that you did is kept afterwards so you are not written to again by mistake. Visit measurements are kept for twenty-five months. Invoices, receipts and the records behind them are kept for seven years, because tax law requires it. Client data is kept for as long as the client is a client, and then deleted once they confirm they have their copy.

Where something has to be kept for one of those reasons it is kept, and a deletion request that collides with a legal obligation gets an honest answer saying which one and for how long.`,
  },
  {
    title: 'How It Is Protected',
    content: `Everything is served over HTTPS. The database sits behind row level security so an account can only read what it is entitled to, administrative access is limited to us and protected by multi-factor authentication, and credentials are held encrypted rather than in files. Backups are taken and are covered by the same controls as the live data.

No system is perfectly secure and we will not pretend otherwise. If a breach affects your personal information we will tell you and, where the law requires it, the authorities, without waiting to be asked and without waiting for the investigation to finish.`,
  },
  {
    title: 'Your Rights',
    content: `You can ask us to confirm whether we hold anything about you, to give you a copy of it in a form you can take elsewhere, to correct it, to delete it, or to stop using it for targeted advertising. You do not need a reason and you do not need a lawyer.

Write to ${SUPPORT_EMAIL} or call ${COMPANY_PHONE}. The first request in any twelve month period costs nothing. You will have an answer within forty-five days, and if a request is genuinely complicated we may take a further forty-five, in which case we will tell you before the first period is up and say why.

If we refuse a request you can appeal it by replying and saying so. An appeal is answered in writing within sixty days with the reasoning behind the decision. If the appeal is refused you may complain to the Texas Attorney General, and nothing here removes a right you have under Texas or federal law.`,
  },
  {
    title: 'Children',
    content: `This site is for businesses and is not directed at children. We do not knowingly collect personal information from anyone under thirteen. If you believe a child has sent us something, write to ${SUPPORT_EMAIL} and it will be deleted.`,
  },
  {
    title: 'Other Sites',
    content: `Pages here link out to client sites, review platforms and other people's tools. Once you follow a link you are on somebody else's site under somebody else's policy, and this one stops at the edge of ours.`,
  },
  {
    title: 'Changes To This Policy',
    content: `This policy will change as the business does. A change that affects what is collected, who it is shared with, or what you can ask for is a material change: the effective date at the top moves, and clients and subscribers are told by email before it takes effect. Corrections that do not change the substance take effect when they are posted.`,
  },
]

/**
 * The studio's own answers, in the shape the second site's record already takes.
 *
 * Gathered into an object rather than left inline so that one page renders both
 * sites. The words are untouched and stay in this file: moving them into a data
 * module beside the subsidiary's would put every line of the studio's published
 * policy through a diff nobody asked for, and a legal page is a bad place to
 * find out that a refactor dropped a paragraph.
 */
const STUDIO = {
  seoTitle: 'Privacy Policy',
  seoDescription:
    'What TaylorURL LLC collects on taylorurl.com and on the sites it builds, who else sees it, how long it is kept, and how to get a copy, correction or deletion.',
  title: 'Privacy Policy',
  description:
    'What is collected here and on the sites we build, what it is used for, who else sees it, and how to have it removed.',
  eyebrow: 'Privacy',
  effectiveDate: 'September 5, 2026',
  appliesTo: 'Visitors, clients, and the customers of sites we build',
  summary: [
    'We do not sell your personal information and we never have.',
    'A visit records the page, where you came from, your browser and an approximate town. Your IP address is read to work that out and is not kept.',
    'Google Analytics, Google Ads and the Meta advertising pixel run on this site. You can turn the advertising ones off, and a browser signal asking us to counts.',
    'On a site we build for a client, their customers’ data is the client’s. We hold it for them and act on their instructions.',
    'Card numbers never reach us. Stripe takes every payment.',
    'Ask and you get a copy, a correction or a deletion, free, with an answer inside forty-five days and an appeal if we say no.',
  ],
  introText: `${BRAND_NAME} is a Texas limited liability company, and it is the company that decides what is collected here and answers for it. This policy is written as "we": the voice is the company's and so is the responsibility. This is the whole of what happens to information that passes through this site and through the sites built on it, and it is written to be read rather than to be survived.`,
  sections: SECTIONS,
}

const DOC = IS_SECOND_SITE ? SECOND_SITE : STUDIO

export default function Privacy() {
  return (
    <>
      <Seo
        title={DOC.seoTitle}
        description={DOC.seoDescription}
        path="/privacy"
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Privacy Policy', path: '/privacy' },
        ])}
      />
      <LegalPage
        {...DOC}
        footer={{
          heading: 'Asking About Your Data',
          body: (
            <>
              Write to{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-accent underline transition-colors duration-200 hover:text-[color:var(--accent-hi)]"
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              or call {COMPANY_PHONE}. A request to see, correct or delete what we hold costs
              nothing and is answered by the people who do the work.
            </>
          ),
        }}
      />
    </>
  )
}
