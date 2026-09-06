/**
 * The running series.
 *
 * A category says what an article is about. A series says which running body of
 * work it belongs to, and that is the axis a reader follows: finish one piece
 * on the map pack and the next three on the map pack are named underneath it.
 * The two cross rather than nest, so a Design article and a Business article
 * can sit in the same series when they answer the same standing question.
 *
 * Membership lives here, keyed on the article's slug, rather than on the
 * article objects. One file to read to see the shape of the whole blog, one
 * line to add when an article is published, and the article files stay as they
 * are - long, and edited only when their own words change.
 *
 * `mark` names a drawing rather than importing one, because this file is read
 * by the sitemap build in plain Node, where a component cannot be.
 */

export const BLOG_SERIES = [
  {
    slug: 'getting-found',
    name: 'Getting Found',
    tagline: 'Showing up when someone searches',
    description:
      'Google, the map pack, reviews, and every free lever a local business has for being the result someone clicks.',
    mark: 'find',
  },
  {
    slug: 'speed-and-vitals',
    name: 'Speed & Vitals',
    tagline: 'What a page costs to open',
    description:
      'Load times, the numbers Google measures a page by, and the difference a fast site makes to the phone ringing.',
    mark: 'gauge',
  },
  {
    slug: 'design-that-sells',
    name: 'Design That Sells',
    tagline: 'Layout, color, and the path to the call',
    description:
      'How a page is laid out, what it says first, and why some sites turn visitors into customers while better-looking ones do not.',
    mark: 'rule',
  },
  {
    slug: 'owners-handbook',
    name: "Owner's Handbook",
    tagline: 'Running a business online',
    description:
      'The decisions that land on the owner: who to hire, what to sign, what to keep current, and what to stop worrying about.',
    mark: 'page',
  },
  {
    slug: 'what-it-costs',
    name: 'What It Costs',
    tagline: 'Budgets, quotes, and what comes back',
    description:
      'Plain figures on what a website costs to build and to keep, what the cheap one really costs, and how to read a quote.',
    mark: 'ledger',
  },
  {
    slug: 'trade-playbooks',
    name: 'Trade Playbooks',
    tagline: 'One trade at a time',
    description:
      'What a website has to do for one trade at a time: the pages it needs, the questions it answers, and the jobs it books.',
    mark: 'trade',
  },
]

/**
 * Which series each article belongs to, keyed on its slug. An article names one
 * series and only one: a piece filed under two is a piece that has not decided
 * what it is for, and a reader following a series would meet it twice.
 */
export const POST_SERIES = {
  'local-seo-the-free-marketing-youre-ignoring': 'getting-found',
  'google-business-profile-the-most-important-free-tool': 'getting-found',
  'why-your-website-needs-a-blog': 'getting-found',
  'why-your-competitors-are-outranking-you-on-google': 'getting-found',
  'how-to-get-more-google-reviews': 'getting-found',
  'schema-markup-the-seo-trick-nobody-talks-about': 'getting-found',
  'what-google-actually-cares-about-in-2026': 'getting-found',

  'image-optimization-the-easiest-speed-win': 'speed-and-vitals',
  'why-fast-websites-make-more-money': 'speed-and-vitals',
  'bounce-rate-what-it-is-and-how-to-fix-it': 'speed-and-vitals',
  'why-your-wix-site-is-costing-you-customers': 'speed-and-vitals',
  'how-fast-should-my-website-load': 'speed-and-vitals',
  'why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone': 'speed-and-vitals',

  'why-your-websites-homepage-is-doing-too-much': 'design-that-sells',
  'why-nobodys-filling-out-your-contact-form': 'design-that-sells',
  'your-website-isnt-a-brochure': 'design-that-sells',
  'what-mobile-first-actually-means': 'design-that-sells',
  'how-to-write-website-copy-that-sounds-human': 'design-that-sells',
  'accessibility-the-website-requirement-youre-ignoring': 'design-that-sells',
  'what-makes-a-good-logo': 'design-that-sells',
  'color-psychology-why-your-website-colors-matter': 'design-that-sells',

  'how-to-pick-a-web-developer-without-getting-burned': 'owners-handbook',
  'your-website-is-your-best-employee': 'owners-handbook',
  'how-to-tell-if-your-web-developer-knows-what-theyre-doing': 'owners-handbook',
  'why-every-business-needs-a-privacy-policy': 'owners-handbook',
  'does-my-business-need-a-website': 'owners-handbook',
  'small-business-website-mistakes': 'owners-handbook',

  'the-real-cost-of-a-cheap-website': 'what-it-costs',
  'the-difference-between-a-500-website-and-a-5000-one': 'what-it-costs',
  'reading-a-web-design-quote-what-each-line-should-mean': 'what-it-costs',

  'what-a-plumbers-website-has-to-do': 'trade-playbooks',
  'hvac-the-two-seasons-your-website-has-to-be-ready-for': 'trade-playbooks',
  'roofers-the-storm-week-your-website-either-handles-or-not': 'trade-playbooks',
  'electricians-a-pricing-page-that-stops-tire-kicker-calls': 'trade-playbooks',
}
