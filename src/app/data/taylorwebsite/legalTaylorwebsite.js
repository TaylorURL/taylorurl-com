/**
 * The Privacy and Terms text this site publishes.
 *
 * Held apart from the views because the two sites answer these questions
 * differently and the answers are facts about each deployment rather than
 * wording. The studio sells through a checkout, publishes a newsletter, runs
 * Google Analytics and the Meta pixel, builds sites that hold other people's
 * customers, and works from a town it names. None of that is true here, and a
 * legal page is the one place on a site where saying otherwise is not a
 * cosmetic error.
 *
 * Every claim below was read off the code rather than assumed. What the enquiry
 * form files is `enquiry_attribution` in `api/contact.js`, which stores the form,
 * the path and the campaign tags and nothing that names a sender. The absence of
 * analytics and of advertising pixels is `analytics: false` and
 * `adTracking: false` on the record in `lib/site/registry.js`, which cut both
 * regions out of the head at build time. The endpoints this site answers on are
 * its `apiAllowlist`, which is why there is no section about payments: there is
 * no checkout here to write one about.
 *
 * Relative import, not `@lib`. Same reason `@constants/seo` takes one - this
 * module has to stay legal under bare node, where no alias resolves.
 */
import { SITE } from '../../../../lib/site/current.js'

const EMAIL = SITE.supportEmail

/**
 * The date the current wording took effect.
 *
 * A material change - what is collected, who it reaches, what you can ask for -
 * moves this and is mailed to clients and subscribers before it applies. A
 * correction that changes no substance takes effect where it is posted.
 */
const EFFECTIVE = 'September 5, 2026'

export const PRIVACY = {
  seoTitle: 'Privacy Policy',
  seoDescription:
    'What this site collects when you read a page or send an enquiry, who else sees it, how long it is kept, and how to get a copy, a correction or a deletion.',

  title: 'Privacy Policy',
  description:
    'What this site collects, what it is used for, who else sees it, and how to have it removed.',
  eyebrow: 'Privacy',
  effectiveDate: EFFECTIVE,
  appliesTo: 'Visitors to this site and the companies I work for',

  summary: [
    'Nothing is sold on this site and there is nothing to sign in to. No accounts, no card details.',
    'The enquiry form is the only thing here that asks you for anything, and what you write goes to my inbox rather than into a database.',
    'No analytics, no advertising pixels and no cookie banner. Reading a page here is not counted.',
    'I do not sell your personal information and I never have.',
    'Ask and you get a copy, a correction or a deletion, free, with an answer inside forty-five days and an appeal if I say no.',
  ],

  introText:
    'TaylorURL LLC is the company behind this site, and it is the company that decides what is ' +
    'collected here and answers for it. It is run by one person, Trenton Taylor, which is why ' +
    'this policy is written as "I": the voice is his and the responsibility is the company’s. ' +
    'This is the whole of what happens to information that passes through this site, and it is ' +
    'written to be read rather than to be survived.',

  sections: [
    {
      title: 'What This Covers',
      content: `This policy covers this site and nothing else.

Everything collected here is collected by me and answers to me. If you sent an enquiry, or simply read a page, this is the whole answer and you can write to me directly.

Work I do for a client is a different matter. It reaches information this site never sees: a database I am building against, an ad account I am repairing tracking in, a list I am sending from. What happens to that is set out under Working On A Project below, and in the agreement signed before any of it starts.`,
    },
    {
      title: 'What The Site Collects',
      content: `Only what the site needs to do its job, and no more than that.

What you hand over: your name, your email address, your business name, what you need, a phone number if you ask to be called back, and whatever you write in the message. That is the enquiry form, and it is the only thing on this site that asks you for anything.

Where an enquiry goes: to my inbox, as an email. The message you wrote is not written into a database. What is filed is the form you used, the page you were on, and any campaign tags the link you arrived on carried, so I can tell which pages and which advertising produce work. That record cannot say who sent anything, because nothing about you is in it.

What reading a page produces on its own: nothing I keep. There is no analytics on this site and no advertising pixel, so a visit is not counted, not timed, and not tied to any later one. The hosting that serves the pages keeps its own short-lived request logs, as any web server does, and I read those only when something is broken.

Your address is read for a moment when you send the form, to count how many messages have come from one connection, and it is not written down.

If a page throws an error in your browser, the error, the address it happened on and the line your browser uses to describe itself are reported to me so I can fix it. Those reports carry the fault, not you.`,
    },
    {
      title: 'What The Site Does Not Do',
      content: `There is nothing to sign in to. No accounts, no passwords, no profile, no member area, and no record of you that carries from one visit to the next.

Nothing is sold here. There is no checkout, no card form and no payment page, so no card number, billing address or bank detail is ever asked for or handled on this site. Work is quoted after a call and invoiced separately, and the Terms page sets that out.

There is no mailing list on this site. Nothing here asks for your address in order to write to you later.

Your browser keeps two small things of its own: which colour setting you picked, and any campaign tags the link you arrived on carried, held for up to ninety days so that an enquiry sent a fortnight after the click still says where it came from. Both sit on your device, both are yours to clear, and clearing them costs you nothing on this site.`,
    },
    {
      title: 'How The Information Is Used',
      content: `To answer you, to quote and carry out work, to invoice for it, to understand which pages and which advertising are worth keeping, and to meet legal and accounting obligations.

It is not used to make an automated decision about you, and it is not used for anything I have not named here. An enquiry does not put you on a mailing list, because there is not one to be put on.`,
    },
    {
      title: 'Cookies, Analytics And Advertising',
      content: `There is no cookie banner on this site, and that is because there is nothing to consent to rather than because I have skipped it.

This site runs no analytics and no advertising pixels. Nothing here counts your visit, follows you to another site, or reports what you read to a third party. If you have a blocker on, it will find nothing to block.

Advertising I run points at this site from elsewhere; the counting happens on the platform running the ad, not in your browser here. What tells me an ad worked is the campaign tag on the link, and that only becomes a record if you choose to send the form.

Should that ever change, this section changes with it and the effective date at the top moves, before the change takes effect rather than after.`,
    },
    {
      title: 'Who The Information Is Shared With',
      content: `I do not sell personal information, I do not trade it, and I do not hand it to anyone for money.

It reaches the companies that run the machinery behind this site and no further: Vercel, which serves the pages; Supabase, which holds the database; and Resend, which delivers the enquiry to my inbox. Each is bound to use what it holds only to provide that service.

Beyond those, information is disclosed only where the law requires it, where it is needed to establish or defend a legal claim, where it is needed to protect somebody's safety, or to a buyer as part of a sale of the business, in which case this policy follows it.`,
    },
    {
      title: 'Where It Is Held',
      content: `This site and taylorurl.com are two sites run by one company on one set of systems. They share a database, an error reporting service and a mail account, which means an enquiry sent here lands in the same inbox and the same database as one sent there.

That is a statement about plumbing rather than about use. Nothing sent here is used for anything named on the other site, and the sharing does not widen who can reach it: administrative access to those systems is limited to me on both.`,
    },
    {
      title: 'Working On A Project',
      content: `Doing the work reaches information this site does not. Building software means working against your database and the accounts it runs on. Repairing tracking means being inside your ad and analytics accounts, and sending hashed contact details back to an ad platform so it can match a conversion to the click that caused it. Running outbound means holding the list, the messages and the replies.

All of it is yours. I hold it on your instructions, use it only to do the work you asked for, and never for anything of my own. I do not sell it, mine it, or add it to a list of mine. You can have a copy at any time, and when the work ends you take it with you.

The accounts stay in your name. For software, so does the repository, which is what lets another engineer pick it up after me. What each of us may do with what the other holds is in the agreement, and the Terms page sets out the shape of it.`,
    },
    {
      title: 'How Long It Is Kept',
      content: `Enquiries and messages are kept for two years from the last contact, so that a conversation picked up again a year later still makes sense. Invoices, receipts and the records behind them are kept for seven years, because tax law requires it. What I hold for a client is kept for as long as the work runs, and then deleted once they confirm they have their copy.

Where something has to be kept for one of those reasons it is kept, and a deletion request that collides with a legal obligation gets an honest answer saying which one and for how long.`,
    },
    {
      title: 'How It Is Protected',
      content: `Everything is served over HTTPS. The database sits behind row level security so an account can only read what it is entitled to, administrative access is limited to me and protected by multi-factor authentication, and credentials are held encrypted rather than in files. Backups are taken and are covered by the same controls as the live data.

No system is perfectly secure and I will not pretend otherwise. If a breach affects your personal information I will tell you and, where the law requires it, the authorities, without waiting to be asked and without waiting for the investigation to finish.`,
    },
    {
      title: 'Your Rights',
      content: `You can ask me to confirm whether I hold anything about you, to give you a copy of it in a form you can take elsewhere, to correct it, or to delete it. You do not need a reason and you do not need a lawyer.

Write to ${EMAIL}. The first request in any twelve month period costs nothing. You will have an answer within forty-five days, and if a request is genuinely complicated I may take a further forty-five, in which case I will tell you before the first period is up and say why.

If I refuse a request you can appeal it by replying and saying so. An appeal is answered in writing within sixty days with the reasoning behind the decision. TaylorURL LLC is a Texas limited liability company, so if the appeal is refused you may complain to the Texas Attorney General, and nothing here removes a right you have under state or federal law.`,
    },
    {
      title: 'Children',
      content: `This site is for businesses and is not directed at children. I do not knowingly collect personal information from anyone under thirteen. If you believe a child has sent me something, write to ${EMAIL} and it will be deleted.`,
    },
    {
      title: 'Other Sites',
      content: `Pages here link out to other people's sites and other people's tools. Once you follow a link you are on somebody else's site under somebody else's policy, and this one stops at the edge of mine.`,
    },
    {
      title: 'Changes To This Policy',
      content: `This policy will change as the business does. A change that affects what is collected, who it is shared with, or what you can ask for is a material change: the effective date at the top moves, and clients are told by email before it takes effect. Corrections that do not change the substance take effect when they are posted.`,
    },
  ],

  footerHeading: 'Asking About Your Data',
}

export const TERMS = {
  seoTitle: 'Terms of Service',
  seoDescription:
    'The terms for working with TaylorURL LLC on software, tracking repair and outbound: how work is quoted, what is paid when, who owns what, and how a complaint is handled.',

  title: 'Terms of Service',
  description:
    'The arrangement between you and me: what I build, how it is quoted, who owns what, and how either of us can end it.',
  eyebrow: 'Terms',
  effectiveDate: EFFECTIVE,
  appliesTo: 'Clients and visitors to this site',

  summary: [
    'Your agreement is with TaylorURL LLC, a limited liability company run by one person. The company is what you engage and what answers.',
    'Nothing is sold on this site. Every price is quoted in writing after a call and agreed before any work starts.',
    'Software and tracking repair are one-off projects. There is no retainer and nothing monthly behind them.',
    'Outbound runs month to month with no term to sign. Setup is billed once at the start.',
    'Before a single outbound message goes out, we sign an agreement covering consent and CAN-SPAM.',
    'For software, the repository and the accounts are in your name, so another engineer can pick it up after me.',
    'I do not promise a number of replies, meetings or sales, and nobody honestly can. I guarantee the work.',
    'Complaints are acknowledged in one business day and answered within five.',
  ],

  sections: [
    {
      title: 'Acceptance Of These Terms',
      content: `Using this website, or engaging me to carry out work, means you accept these terms. If you do not accept them, do not use my services. Where a signed agreement, statement of work or quote says something different from this page, that document governs for that project and these terms cover everything it does not.`,
    },
    {
      title: 'Who You Are Contracting With',
      content: `These terms are between you and ${SITE.brandName}, a Texas limited liability company. The company is the party to this agreement, and it is the company you are engaging, paying and holding to these terms.

The company is run by Trenton Taylor, its sole member and manager, and he is the person who does the work and answers the email. That is why these pages are written as "I" and "me": the voice is his and the party is the company, and every obligation and every liability on this page is the company's.

The work is done remotely and the people it is done for are anywhere. There is no premises where visitors are received. You can reach a person at ${EMAIL}.`,
    },
    {
      title: 'What I Provide',
      content: `Three things. Custom software built to order: applications, integrations, automations and internal tools. Conversion tracking repaired, so the leads an ad platform counts are the ones that actually came in. Outbound email run for you, from a sending domain registered in your name.

The scope, deliverables, timeline and price for your project are set out in your own agreement. Anything outside that scope is new work and is quoted before it is started, never added to an invoice afterwards.`,
    },
    {
      title: 'Nothing Is Sold On This Site',
      content: `There is no checkout here and no account to open. This site describes what I do and gives you a form to start a conversation on, and that is the whole of what it does.

Every engagement starts with a call. The number comes back in writing, and you agree to it before anything begins. The figures shown on the service pages are floors rather than quotes: a bigger job costs more, and you will know that number before it costs you anything.`,
    },
    {
      title: 'Payment Terms',
      content: `Software is priced per project, because no two are the same, and the schedule is set out in your agreement. Tracking repair is a flat fee, paid once before the work begins. Neither carries a retainer or a monthly charge; the project ends when it is done.

Outbound is billed monthly and runs month to month, with no term to sign. Registering the domains, standing up the mailboxes and setting the sending tools up is done once and billed once on top of the first month. You agree to both figures before anything starts.

Charges for things bought on your behalf, such as a domain name, a mailbox or a paid tool, are passed through at cost and shown separately. Invoices are raised and paid outside this site.`,
    },
    {
      title: 'Late Payment And Suspension',
      content: `If an invoice goes unpaid you will hear from me about it rather than discover it from a service that stopped. For outbound, sending pauses while an account is behind and resumes when it is current; pausing is not deletion, and the domains, the mailboxes and the list are untouched by it.

Where work is being paid for in stages, work stops at the end of a stage that has not been paid for, and starts again when it has.`,
    },
    {
      title: 'What You Are Responsible For',
      content: `Giving me the access, the accounts and the information I need to do the work; answering questions and reviewing what comes back in reasonable time; making sure what you tell me about your business is accurate; and paying on the terms agreed.

A project runs on the slower of the two of us. Where access or approvals are outstanding, the timeline moves by the time it takes to get them, and I will say so at the time rather than at the end.`,
    },
    {
      title: 'Your Content And The Rights To It',
      content: `You keep everything you supply. You also confirm, by supplying it, that you are entitled to: that the material is yours or licensed, that the copy is not lifted from somebody else, and that nothing you hand over infringes anyone's rights or breaks any law.

If a claim is made against me because of material you supplied or instructed me to publish or to send, you cover the cost of dealing with it. If I am the one who put something out without the right to, that is mine to fix and mine to pay for.`,
    },
    {
      title: 'Outbound Email And The Law',
      content: `Before a single message goes out, you and I sign an agreement covering consent and how the sending complies with CAN-SPAM. That is not a formality and it is not optional; the sending does not start without it.

Every message carries a real postal address and a working way to opt out, and an opt out is honoured on the first send after it arrives. Lists are researched and checked one company at a time against what you sell. Nothing is bought from a list broker, and I will not send to a list you bought from one.

Sending goes out from a domain registered for you, with SPF, DKIM and DMARC set and tested first, and it warms up over several weeks before it runs at full rate. Skipping that is how mail ends up in spam, so it is not a step either of us can decide to skip.

If you ask me to send something that would break the law or the agreement, I will say no, and continuing to ask is grounds to end the arrangement.`,
    },
    {
      title: "Your Data And Your Customers' Data",
      content: `Doing the work puts me inside accounts and records that are yours: a database, an ad account, an analytics property, a list of people you want to write to, and the replies that come back. All of it is yours. I hold it on your instructions, use it only to run the work you asked for, and never for anything of my own.

I do not sell it, share it, or add it to a list of mine. You can have a copy at any time. Where tracking work sends contact details back to an ad platform, they are hashed before they go, which is what the platform requires and what keeps the details themselves on your side of the line. If I become aware of a breach affecting any of it, you will hear from me promptly and with what I know, so that you can meet your own obligations. The Privacy page sets this out in full.`,
    },
    {
      title: 'Ownership',
      content: `For software, what is built is yours. The repository and the accounts it runs on are in your name from the start, which is the point: another engineer can pick the work up after me without asking my permission or waiting for a handover. There is no licence to keep current and nothing switches off when the project ends.

For tracking repair, the configuration is yours and it lives in your own accounts. For outbound, the sending domains, the mailboxes and the list are registered and held in your name, and they stay with you.

I keep the general knowledge, methods and reusable components I brought to the job, and I may use them again elsewhere. That is not your material and using it again takes nothing from you.

I may describe completed work in general terms unless you ask me not to, and asking costs nothing. Nothing about you is named without your say-so.`,
    },
    {
      title: 'Acceptable Use',
      content: `Nothing I build, repair or send may be used to break the law, to infringe someone else's rights, to send email to people who have opted out, to distribute malware, or to deceive the people it reaches.

If something crosses one of those lines I will tell you what the problem is and give you a fair chance to fix it. Where the breach is one that cannot wait, because it is causing harm or exposing me or my other clients to liability, the sending or the service stops first and is discussed second.`,
    },
    {
      title: 'Third-Party Services',
      content: `Some of what the work depends on is not mine: the domain registrar, the mail provider, the ad platform, the analytics property, the hosting, and any tool you have asked for. Each has its own terms, its own pricing and its own uptime, and I pick them on the same basis I would for my own work.

Where one of them fails, changes its pricing, withdraws a feature or changes how it counts something, I will tell you and find the best way through it. I cannot be responsible for the acts of a company I do not run, and I will not pretend the choice was not mine either.`,
    },
    {
      title: 'What I Do Not Promise',
      content: `Services are provided as they are, without warranties of any kind beyond what your agreement sets out.

For outbound: how many messages go out, whether they arrive, and what they say are what I control. Nobody can promise a number of replies, meetings or sales, and anyone who does is guessing.

For tracking repair: the months already reported stay wrong. Fixing the tracking gives you a clean record from the day it is fixed, and nothing recovers what was mismeasured before it. I do not guarantee any particular figure will go up once the numbers are right, only that they will be right.

For software: I do not guarantee that a system will be uninterrupted or free of faults. Faults found in what I built, inside the period your agreement names, are fixed as part of the work.`,
    },
    {
      title: 'Cancellation And Ending The Work',
      content: `Outbound runs month to month. There is no cancellation fee and no notice period. To stop it, write to ${EMAIL}; there is no form to find and no retention call to sit through. Billing stops at the end of the period you have already paid for, and sending stops with it. The domains, the mailboxes and the list are yours and stay yours.

Project work can be stopped by either of us in writing. You are responsible for payment for the work carried out up to that date. Where a project ends part way through, whether a fee already paid is refunded in whole or in part depends on how much of it had been done, and I will put the calculation in writing before anything is settled, so you can see the reasoning rather than just the figure.

Whatever the reason for ending it, you get what has been built and a copy of anything I hold for you.`,
    },
    {
      title: 'Confidentiality',
      content: `Both of us keep the other's confidential information to ourselves. That covers business plans, figures, customer lists, credentials, technical detail about how something works, and anything marked confidential or obviously meant to be. It does not cover anything already public, anything either of us knew beforehand, or anything a court or regulator requires to be disclosed.`,
    },
    {
      title: 'Who Is Liable',
      content: `Every obligation on this page is ${SITE.brandName}'s, and a claim arising out of the work or out of these terms lies against the company. Under the Texas Business Organizations Code, the member and manager of a Texas limited liability company is not personally liable for the debts, obligations or liabilities of the company, and nothing in these terms or in any project agreement changes that.

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
      content: `You agree to cover the company's reasonable costs, including legal costs, arising from a third-party claim caused by material you supplied, by instructions you gave me, by a list or a recipient you insisted on, or by use of the work in breach of the acceptable use section above. That cover extends to the company's member, manager, employees and contractors. The company agrees to do the same for you where a claim arises from its own infringement or its own breach of these terms.`,
    },
    {
      title: 'Events Outside My Control',
      content: `Neither of us is in breach for a delay or a failure caused by something genuinely outside our control: a hosting or network outage upstream, a mail provider or ad platform going down or changing its rules, a power failure, an act of government, or a serious illness. Where one of those things happens I will tell you as soon as I know, say what I am doing about it, and get back to normal as quickly as I can.`,
    },
    {
      title: 'Complaints',
      content: `If something is wrong, say so and it gets dealt with. Write to ${EMAIL}, and you will have an acknowledgement within one business day and an answer or a plan within five.

Raising a complaint costs you nothing and does not affect your work or your billing while it is being looked at. If we cannot settle it between us, you are free to take it to any consumer body or court with jurisdiction, and nothing in these terms is intended to remove a right you have under state or federal law.`,
    },
    {
      title: 'Changes To These Terms',
      content: `These terms may change. A change that affects what you pay, what you own, or how either of us may end the arrangement is a material change, and existing clients are told about one by email at least thirty days before it takes effect, so nobody is bound by a term they were never shown. Corrections that do not change the substance take effect when they are posted here, and the effective date at the top moves with them. Continuing to use my services after a change takes effect is acceptance of it.`,
    },
    {
      title: 'Governing Law',
      content: `These terms are governed by the laws of the State of Texas, without regard to its conflict of law provisions. Where a dispute cannot be settled between us or through the complaints route above, it is to be resolved in the courts of Harris County, Texas.

Nothing here waives or limits a right you have under state or federal consumer protection law, and any term on this page that would have that effect does not apply to you.`,
    },
    {
      title: 'General',
      content: `If any part of these terms is found to be unenforceable, the rest stands. Not enforcing a term on one occasion is not a waiver of it. Neither of us may transfer this arrangement to somebody else without the other's written agreement, except that I may transfer it as part of a sale of the whole business, on the same terms. Notices under these terms are given in writing by email to the addresses each of us uses for the work.

These terms, together with your own agreement and the Privacy page, are the whole of the arrangement between us, and they replace anything said before them.`,
    },
  ],

  footerHeading: 'Questions About These Terms',
}
