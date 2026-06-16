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
    title: 'Search visibility',
    description:
      'When customers search for what you do, the businesses that rank are the ones with real websites. Without one, you are not in the conversation.',
    icon: Search,
  },
  {
    title: 'Always available',
    description:
      'Your site answers questions, captures leads, and accepts bookings outside business hours. The work continues while you sleep.',
    icon: Clock,
  },
  {
    title: 'Credibility',
    description:
      'People check you out before they call. A professional site tells them you are established, serious, and worth doing business with.',
    icon: Shield,
  },
  {
    title: 'Reach beyond referrals',
    description:
      'Word of mouth is valuable, but it is not scalable. A website puts you in front of customers who have never heard of you before.',
    icon: Users,
  },
  {
    title: 'Built for mobile',
    description:
      'Most local searches happen on a phone. If the site is not fast and usable there, you lose the customer before the first tap.',
    icon: Smartphone,
  },
  {
    title: 'Real return',
    description:
      'One new customer typically covers the cost of the site. After that, the work it does for you is pure upside.',
    icon: DollarSign,
  },
]

export const HOW_IT_WORKS_STEPS = [
  {
    step: '1',
    title: 'Get in touch',
    description:
      'Call, text, or email. Tell me what your business does and what you need. You get a straight answer, not a proposal deck.',
  },
  {
    step: '2',
    title: 'I build it',
    description:
      'I get to work and share progress as I go. Feedback is welcome at any stage. No long timelines, no surprises.',
  },
  {
    step: '3',
    title: 'Launch',
    description:
      'Your site goes live. I handle hosting, updates, and security after launch so you can stay focused on the business.',
  },
]

export const CHART_AXIS_STYLE = { fill: '#6b7280', fontSize: 12 }
export const CHART_TOOLTIP_STYLE = { borderRadius: '8px', border: '1px solid #e5e7eb' }

export const HERO_BADGES = ['Cancel anytime', 'Free initial consultation']

export const LOCAL_SEARCH_STATS = [
  { value: '97%', label: 'search online first' },
  { value: '72%', label: 'visit within 5 miles' },
  { value: '88%', label: 'trust online reviews' },
]
