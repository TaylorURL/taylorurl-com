/**
 * What taylor.website's contact page says.
 *
 * Same shape as the studio's half of `@data/contact`, because one view renders
 * both forms. What differs is what is being asked about: a job to build, a
 * measurement to repair, or a list to write to, rather than a website for a
 * shop in a named town.
 *
 * `place` replaces the studio's town with the reach. The registry carries no
 * location for this site — deliberately, because there is no address to claim —
 * so drawing a pin over it would be a label standing on nothing.
 *
 * `projectTypes` carry values of their own rather than the studio's. The value
 * is what the enquiry is filed under, and two sites filing different offers
 * under one set of names would leave the inbox unable to tell a tracking job
 * from a redesign.
 */
import { Globe } from 'lucide-react'

export const CONTACT_PAGE = {
  seo: {
    title: 'Contact a Software Engineer',
    description:
      'Tell me what the work is and what it has to do. A reply usually comes within the hour, and a scope and a price in writing before anything starts.',
  },

  hero: {
    eyebrow: 'Get in Touch',
    title: 'A scope and a price, before any work starts.',
    description:
      'Tell me what you need built, what your tracking is getting wrong, or who you want to reach. The reply usually comes back within the hour, and nothing is charged to find out what it costs.',
  },

  aside: {
    eyebrow: 'Who Answers',
    heading: 'One person scopes it, builds it, and answers you.',
    para: 'A system to build, tracking that reports the wrong number, or outbound nobody at your company has time to run. Tell me what the work is and what it has to do when it is done.',
  },

  place: {
    icon: Globe,
    label: 'Coverage',
    value: 'Companies anywhere',
  },

  steps: [
    {
      title: 'First call',
      description:
        'You tell me what the work is and what it has to do. I ask what I need to scope it, and say so if the work is not worth doing.',
    },
    {
      title: 'Scope and price',
      description:
        'What gets built, how long it takes, what it costs, and what is not included. In writing, before anything is charged.',
    },
    {
      title: 'The work',
      description:
        'I do it, show you where it stands as it goes, and hand it over in your name. A small job runs a week or two, a full build six to twelve.',
    },
  ],

  form: {
    heading: 'Tell me about the work',
    confirmation:
      'Thanks. A reply usually comes back within the hour, and a scope and a price before any work starts.',
    submit: 'Get a Scope and a Price',
    shortMessage: 'A sentence about what you need is enough to start.',
    placeholders: {
      email: 'you@yourcompany.com',
      company: 'Your company name',
      message:
        'What your company does, what you need built or fixed, and anything you have already tried.',
    },
  },

  projectTypes: [
    { value: 'software', label: 'Custom software or an integration' },
    { value: 'tracking', label: 'Conversion tracking that is wrong' },
    { value: 'outbound', label: 'Outbound email' },
    { value: 'other', label: 'Something else' },
  ],

  included: {
    eyebrow: 'How the Work Runs',
    headingLine: 'What holds',
    accentText: 'on every job.',
    lede: 'The same nine, whichever of the three you buy and whatever it costs.',
  },

  includedItems: [
    'A scope and a price in writing',
    'A finish date agreed before work starts',
    'What is not included, named up front',
    'One person on the work, start to finish',
    'Repositories and accounts in your name',
    'A written account of what was done',
    'Replies usually inside the hour',
    'No retainer and no term to sign',
    'A straight answer when the work is not worth doing',
  ],
}
