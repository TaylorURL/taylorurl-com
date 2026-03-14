import { Clock, DollarSign, Search, Shield, Smartphone, Users } from 'lucide-react'

export const CUSTOMER_DISCOVERY_DATA = [
  { name: 'Google Search', value: 46 },
  { name: 'Social Media', value: 24 },
  { name: 'Word of Mouth', value: 18 },
  { name: 'Direct Visit', value: 8 },
  { name: 'Other', value: 4 },
]

export const REVENUE_GROWTH_DATA = [
  { month: 'Jan', withSite: 100, withoutSite: 100 },
  { month: 'Mar', withSite: 118, withoutSite: 102 },
  { month: 'May', withSite: 140, withoutSite: 104 },
  { month: 'Jul', withSite: 165, withoutSite: 106 },
  { month: 'Sep', withSite: 188, withoutSite: 108 },
  { month: 'Nov', withSite: 210, withoutSite: 110 },
]

export const WHY_WEBSITE_CARDS = [
  {
    title: 'Show Up on Google',
    description:
      'If someone searches "plumber near me" and you don\'t pop up, you just lost that job to the guy down the street. Simple as that.',
    icon: Search,
  },
  {
    title: 'Open While You Sleep',
    description:
      "Your website takes calls at 2am. Answers the same questions you're tired of answering. Books jobs while you're on a job.",
    icon: Clock,
  },
  {
    title: 'People Google You',
    description:
      "Before anyone calls, they look you up. No website? They assume you're either closed or not serious. That's just how it works now.",
    icon: Shield,
  },
  {
    title: 'More Than Word of Mouth',
    description:
      "Referrals are great, but they don't scale. A website puts you in front of people who've never heard of you — and that's where the growth is.",
    icon: Users,
  },
  {
    title: 'Phones First',
    description:
      "Your customers are searching from their truck, their couch, their kid's soccer game. If your site doesn't work on a phone, it doesn't work.",
    icon: Smartphone,
  },
  {
    title: 'It Pays for Itself',
    description:
      "One new customer and the site has already made its money back. That's not a sales pitch — it's just math.",
    icon: DollarSign,
  },
]

export const HOW_IT_WORKS_STEPS = [
  {
    step: '1',
    title: 'Hit Us Up',
    description:
      "Call, text, email — whatever works. Tell us what you need and we'll give you a straight answer and a real quote. No 47-page proposal.",
  },
  {
    step: '2',
    title: 'We Build It',
    description:
      'We get to work. You see progress along the way and can tell us to change anything. No surprises, no waiting months.',
  },
  {
    step: '3',
    title: "You're Live",
    description:
      'Site goes live, we handle everything after — hosting, updates, security. You go back to running your business.',
  },
]

export const CHART_AXIS_STYLE = { fill: '#6b7280', fontSize: 12 }
export const CHART_TOOLTIP_STYLE = { borderRadius: '8px', border: '1px solid #e5e7eb' }

export const HERO_BADGES = ['Cancel anytime', 'Free consultation']

export const LOCAL_SEARCH_STATS = [
  { value: '97%', label: 'search online first' },
  { value: '72%', label: 'visit within 5 miles' },
  { value: '88%', label: 'trust online reviews' },
]
