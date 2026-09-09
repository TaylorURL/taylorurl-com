import { Code2, Headphones, Heart, Shield, Zap } from 'lucide-react'
import { CLIENT_PROJECTS, PORTFOLIO_AVERAGES } from '@data/portfolio'
import { ABOUT_PAGE as TAYLORWEBSITE_ABOUT } from '../taylorwebsite/aboutTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * What the about page says, for whichever site is building.
 *
 * `@views/About` renders one layout and takes every sentence from here, so the
 * second site is a body of copy rather than a second view: a section added to
 * the page is added once, and neither site can quietly lose it.
 *
 * The studio's values are transcribed from where they were written into the
 * view, down to the wording and the punctuation, because this file existing
 * must not move a page that has been indexed for a year.
 *
 * - `story.paragraphs` are the three under the story heading, in order.
 * - `stats` is either a written `value` or a `to` the page counts up to.
 * - `place` is the card under the figures: an icon, the label over it, and the
 *   paragraph that says where the work happens.
 * - `work` and `processIntro` are the two banded headings, each a first line
 *   and an accented second one.
 * - `closing` is the last band's ask.
 */
const STUDIO_ABOUT = {
  seo: {
    title: 'About TaylorURL, Baytown Web Design Team',
    description:
      'A small team of designers, developers, and local-search specialists in Baytown, TX, bringing customers to shops, trades, and small businesses around Houston.',
  },

  hero: {
    eyebrow: 'About Us',
    title: 'A small team of experts who bring you customers.',
    description:
      'We are designers, developers, and local-search specialists. We answer the phone, we build the site, and when your hours change you text us. Most of our clients are shops and trades around Baytown and the Houston area.',
  },

  story: {
    eyebrow: 'Our Story',
    heading: 'Baytown shops end up with one of two websites.',
    paragraphs: [
      'One is an agency build that cost more than the shop could justify and looks like every other site that agency sells. The other went up on a free builder years back and still shows hours that changed a while ago.',
      'We started TaylorURL in Baytown to be the third option. We build the site ourselves and stay the people who answer when it needs to change. The team is small enough that there is nobody here to hand you off to.',
      'Hosting, backups, monitoring and the small content changes are in the price, and the price stays where it started. The domain is yours and stays in your name.',
    ],
  },

  // The two measured figures are read off the portfolio rather than written
  // here. Both were literals, and both were the kind of literal nobody
  // revisits: one re-measured client left this page averaging a set of scores
  // the portfolio no longer held, and a twelfth client would have left it
  // counting eleven.
  stats: [
    { value: '2-4', unit: 'wk', label: 'Average Build Time' },
    { to: PORTFOLIO_AVERAGES.mobile, suffix: '', unit: '', label: 'Average PageSpeed, Mobile' },
    { to: CLIENT_PROJECTS.length, suffix: '', unit: '', label: 'Client Sites Live' },
    { value: '<1', unit: 'hr', label: 'Typical Reply Time' },
  ],

  place: {
    icon: Heart,
    label: 'Baytown, TX',
    body: 'Working with local businesses around Baytown, Mont Belvieu, Channelview, Crosby, La Porte, Deer Park, Pasadena, and the rest of the Houston area. The whole project happens by phone, text, and email. No in-person meeting is required.',
  },

  values: [
    {
      icon: Code2,
      title: 'Nobody else has this site',
      description:
        'Your site starts as an empty file, not a theme with your logo dropped into it. Nothing on it loads that you did not ask for, and it looks like your shop instead of the one across town.',
    },
    {
      icon: Headphones,
      title: 'You talk to the people doing the work',
      description:
        'No account manager sits between you and the build. You send a message, it lands on the phone of somebody who works on your site, and the answer usually comes back inside the hour.',
    },
    {
      icon: Zap,
      title: 'Live in two to four weeks',
      description:
        'Most sites go live inside a month. The time goes into building the thing rather than into meetings about building it. You tell us about the business, we get to work.',
    },
    {
      icon: Shield,
      title: 'Built for local businesses',
      description:
        'Plumbers, barbers, printers, restaurants, contractors. Businesses that get looked up on a phone before anyone walks in, and that need somebody who picks up when the hours change.',
    },
  ],

  work: {
    eyebrow: 'How We Work',
    headingLine: 'Why owners',
    accentText: 'work with us.',
    lede: "Four things we won't budge on, whatever the shop does and whatever the site costs.",
  },

  processIntro: {
    eyebrow: 'Process',
    headingLine: 'Four steps from',
    accentText: 'first call to launch.',
    lede: 'This is the whole build, start to finish. There is no twelve-step onboarding behind it.',
  },

  process: [
    {
      num: '01',
      title: 'You reach out',
      description:
        'Tell us about the business and what you need. A few sentences is plenty. There is no thirty-field intake form.',
      you: 'Send us a message',
      me: 'Reply usually within the hour',
    },
    {
      num: '02',
      title: 'We plan it out',
      description:
        'A written plan comes back with the price on it. Nothing gets built until you tell us the plan is right.',
      you: 'Look it over and give feedback',
      me: 'Send a plan and a price in writing',
    },
    {
      num: '03',
      title: 'We build it',
      description:
        'You watch it come together on a preview link rather than in a status email. Say the word at any point and we change it there and then.',
      you: 'Review and request changes',
      me: 'Build, test, and polish',
    },
    {
      num: '04',
      title: 'Launch and look after it',
      description:
        'Your site goes live. Hosting, backups and updates stay on our side, so nothing technical ever lands on your desk.',
      you: 'Run the business',
      me: 'Keep everything running',
    },
  ],

  // The studio's closing band draws the accent inline and carries the full
  // stop outside it; the second site's draws the same words through
  // `@components/CtaBanner`, which takes the accented tail whole.
  closing: {
    eyebrow: 'Get in Touch',
    heading: 'Tell us about',
    accentText: 'the business',
    description:
      'A few sentences on what you do and who you want walking in. A reply usually comes back within the hour: a straight answer on fit, then a plan and a price.',
  },
}

/**
 * The page for whichever site is building.
 *
 * Compared against the substituted literal rather than looked up, so the site
 * that lost is dropped from the bundle instead of shipping the other offer's
 * copy inside this one.
 */
export const ABOUT = IS_SECOND_SITE ? TAYLORWEBSITE_ABOUT : STUDIO_ABOUT
