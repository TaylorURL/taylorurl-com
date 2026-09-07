import { MapPin } from 'lucide-react'
import { COMPANY_LOCATION } from '@constants/navigation'
import { CONTACT_PAGE as TAYLORWEBSITE_CONTACT } from '../taylorwebsite/contactTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * What the contact page says, for whichever site is building.
 *
 * `@views/Contact` renders one form and takes every sentence from here, so a
 * field reworded or a step renamed happens once. The field labels themselves
 * are not here: they are the questions the notice reads back, and those live in
 * `lib/enquiry/questions.js` so the page and the inbox cannot drift.
 *
 * The studio's values are transcribed from where they were written into the
 * view, down to the wording and the punctuation, because this file existing
 * must not move a page that has been indexed for a year.
 *
 * - `place` is the third row of the contact card: a mark, the label over it,
 *   and the line under it.
 * - `form.placeholders` are the three boxes whose hint names the offer. The
 *   name box asks for a name on both sites, so it is left in the markup.
 * - `projectTypes` are the options under "What you need", and the `value` is
 *   what the enquiry is filed under.
 */
const STUDIO_CONTACT = {
  seo: {
    title: 'Contact a Baytown Web Designer',
    description:
      'Tell a Baytown web designer what the business does and what the site has to do. A reply usually comes within the hour, a plan and a price before any work starts.',
  },

  hero: {
    eyebrow: 'Get in Touch',
    title: 'A plan and a price, before any work starts.',
    description:
      'Tell me about your Baytown or Houston-area business and what the site has to do. The reply usually comes back within the hour, and nothing is charged to find out what it costs.',
  },

  aside: {
    eyebrow: 'Who Answers',
    heading: 'One person builds it and answers the phone.',
    para: 'A new site, an old one that needs redoing, or a site someone else built and walked away from. Tell me what the business does and what has to change.',
  },

  place: {
    icon: MapPin,
    label: 'Location',
    value: COMPANY_LOCATION,
  },

  steps: [
    {
      title: 'First call',
      description:
        'You tell me what the business does and what the site has to do. I ask what I need to price it, and say so if the work is not worth doing.',
    },
    {
      title: 'Plan and price',
      description:
        'What gets built, how long it takes, what it costs, and what happens after launch. In writing, before anything is charged.',
    },
    {
      title: 'Build and go live',
      description:
        'I build it, show you the work as it goes, and put it online. Most sites are live in two to four weeks.',
    },
  ],

  form: {
    heading: 'Tell me about the business',
    confirmation:
      'Thanks. A reply usually comes back within the hour, and a plan and a price before any work starts.',
    submit: 'Get My Plan and Price',
    shortMessage: 'A sentence about the business is enough to start.',
    placeholders: {
      email: 'you@yourbusiness.com',
      company: 'Your business name',
      message:
        'What the business does, what you want the site to do, and anything the current one gets wrong.',
    },
  },

  projectTypes: [
    { value: 'new-website', label: 'A brand-new website' },
    { value: 'redesign', label: 'Redo my current site' },
    { value: 'web-app', label: 'Online booking or a custom tool' },
    { value: 'optimization', label: 'Make my site faster' },
    { value: 'maintenance', label: 'Take over hosting and care' },
  ],

  included: {
    eyebrow: "What's Included",
    headingLine: 'What comes',
    accentText: 'with every project.',
    lede: 'No add-on for the basics, and no invoice for a change. Nine things, every project.',
  },

  includedItems: [
    'Built from scratch, not a template',
    'Works on every device',
    'Hosting taken care of',
    'Updates and fixes without being asked',
    'Errors reported the moment they happen',
    'Fast pages, checked on Google’s own test',
    'Daily backups',
    'Text and photo changes, no charge',
    'One person who answers',
  ],
}

/**
 * The page for whichever site is building.
 *
 * Compared against the substituted literal rather than looked up, so the site
 * that lost is dropped from the bundle instead of shipping the other offer's
 * copy inside this one.
 */
export const CONTACT = IS_SECOND_SITE ? TAYLORWEBSITE_CONTACT : STUDIO_CONTACT
