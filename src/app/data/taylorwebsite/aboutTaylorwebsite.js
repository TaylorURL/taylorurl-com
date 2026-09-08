/**
 * What taylor.website's about page says.
 *
 * Same shape as the studio's half of `@data/about`, because one view renders
 * both pages. What differs is the offer and the reach, not the layout.
 *
 * Nothing here names a town, a trade or a client, and the figures are counts of
 * what this site sells rather than measurements off a portfolio, because this
 * site has no portfolio to measure. The studio's stats are read off
 * `@data/portfolio`; these are written out, since a second site quoting the
 * studio's client scores would be borrowing proof it has not earned.
 */
import { Code2, Globe, Headphones, Shield, Zap } from 'lucide-react'

export const ABOUT_PAGE = {
  seo: {
    title: 'About Trenton Taylor, Software Engineer',
    description:
      'We are a small team that builds custom software, repairs conversion tracking, and runs outbound email for companies anywhere. You talk to the people doing the work.',
  },

  hero: {
    eyebrow: 'About Us',
    title: 'A small team scopes the work, builds it, and hands it over.',
    description:
      'We take the first call, and we are who you message while the work runs. We build software to order, repair conversion tracking, and run outbound email.',
  },

  story: {
    eyebrow: 'How It Usually Goes',
    heading: 'Work like this usually goes to a team you never meet.',
    paragraphs: [
      'An agency sells you the work, and the people who scoped it hand it to whoever is free. The person answering your email in month three has never opened the code.',
      'The other option is a contractor who takes the job, finishes it, and leaves you with something nobody can pick up: no repository you own, no account in your name, no written record of what was done.',
      'We do the work ourselves, and we are still who you message while it is running. Everything is handed over in your name with a written account of what was done, so you are not tied to us to keep using it.',
    ],
  },

  stats: [
    { value: '3', unit: '', label: 'Services' },
    { value: '1', unit: '', label: 'Person on the Work' },
    { value: '<1', unit: 'hr', label: 'Typical Reply Time' },
    { value: '0', unit: '', label: 'Contracts With a Term' },
  ],

  place: {
    icon: Globe,
    label: 'Anywhere',
    body: 'Every part of this happens over calls, screen shares, and email, so where your company sits makes no difference to the work or the price. Nothing needs to be signed in person.',
  },

  values: [
    {
      icon: Code2,
      title: 'You own what gets built',
      description:
        'The repository, the domains, and the accounts are registered in your name. Another engineer can pick the work up after us without asking us for anything.',
    },
    {
      icon: Headphones,
      title: 'You talk to the person doing the work',
      description:
        'No account manager sits between you and the work. You send a message, it lands on the phone of somebody building it, and the answer usually comes back inside the hour.',
    },
    {
      icon: Zap,
      title: 'A price and a date before anything starts',
      description:
        'Both come back in writing after the first call, and neither moves once you have agreed to them unless you ask for something that was not in the scope.',
    },
    {
      icon: Shield,
      title: 'What it does not cover is said first',
      description:
        'Every service page names the work that is not included. You find that out at the start rather than halfway through.',
    },
  ],

  work: {
    eyebrow: 'How We Work',
    headingLine: 'What you get',
    accentText: 'on every job.',
    lede: 'Four things that hold whichever of the three you buy, and whatever the work costs.',
  },

  processIntro: {
    eyebrow: 'Process',
    headingLine: 'Four steps from',
    accentText: 'first message to handover.',
    lede: 'This is the whole of it, start to finish. There is no onboarding sequence behind it.',
  },

  process: [
    {
      num: '01',
      title: 'You get in touch',
      description:
        'Tell us what the work is and what it has to do when it is done. A few sentences is plenty. There is no thirty-field intake form.',
      you: 'Send us a message',
      me: 'Reply usually within the hour',
    },
    {
      num: '02',
      title: 'We go through it',
      description:
        'A call, then a read of how the job runs now. We ask what we need to scope it, and say so if the work is not worth doing.',
      you: 'Walk us through the job',
      me: 'Ask what we need to price it',
    },
    {
      num: '03',
      title: 'You get a price and a date',
      description:
        'What gets built, how long it takes, what it costs, and what is not included. In writing, before anything is charged.',
      you: 'Read it and say yes or no',
      me: 'Send the scope, the price, and the date',
    },
    {
      num: '04',
      title: 'We do the work and hand it over',
      description:
        'You see where it stands as it goes rather than in a status email. At the end everything is in your name, with a written account of what was done. Outbound is the one that keeps running; the other two end when they are done.',
      you: 'Review as it goes',
      me: 'Build, test, and hand over',
    },
  ],

  closing: {
    eyebrow: 'Get in Touch',
    heading: 'Tell us about',
    accentText: 'the work.',
    description:
      'A few sentences on what you need and what it has to do when it is done. A reply usually comes back within the hour: a straight answer on whether it is a fit, then a scope and a price.',
  },
}
