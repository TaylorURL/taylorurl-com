import { Clock, DollarSign, Search, Shield, Smartphone, Users } from 'lucide-react'

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
    title: 'Get found on Google',
    description:
      'When people search for what you do, the businesses that show up are the ones with a real website. Without one, you are not in the running.',
    icon: Search,
  },
  {
    title: 'Open day and night',
    description:
      'Your website answers questions, takes messages, and accepts bookings while you are closed. It keeps working when you cannot.',
    icon: Clock,
  },
  {
    title: 'Look professional',
    description:
      'People check you out before they call. A clean, well-built website tells them you are serious, established, and worth picking up the phone for.',
    icon: Shield,
  },
  {
    title: 'Reach new customers',
    description:
      'Word of mouth is great, but it only goes so far. A website puts you in front of people who have never heard of you before.',
    icon: Users,
  },
  {
    title: 'Works on every phone',
    description:
      'Most people search on their phones. If the site is slow or hard to use there, they tap the back button before they ever call you.',
    icon: Smartphone,
  },
  {
    title: 'Pays for itself',
    description:
      'One or two new customers usually covers the whole site. Everything after that goes straight to your bottom line.',
    icon: DollarSign,
  },
]

export const HOW_IT_WORKS_STEPS = [
  {
    step: '1',
    title: 'Get in touch',
    description:
      'Call, text, or email. Tell me what your business does and what you need. You get a straight answer, not a sales pitch.',
  },
  {
    step: '2',
    title: 'I build it',
    description:
      'I get to work and show you progress as I go. You can give feedback any time. No drawn-out timelines, no surprises.',
  },
  {
    step: '3',
    title: 'Go live',
    description:
      'Your site goes live. I take care of keeping it online, fast, and safe so you can stay focused on running the business.',
  },
]

export const HERO_BADGES = ['Cancel anytime', 'Free initial consultation']

export const CLIENT_TESTIMONIALS = [
  {
    name: 'Maria Rodriguez',
    business: 'Rodriguez Family Restaurant',
    role: 'Owner',
    color: 'bg-orange-500',
    quote:
      "They just handle it. I don't know anything about websites and I don't want to. Online orders are up 40% since launch and I didn't have to learn a single thing.",
  },
  {
    name: 'James Mitchell',
    business: 'Mitchell Plumbing & HVAC',
    role: 'Owner',
    color: 'bg-blue-600',
    quote:
      'Went from maybe 2-3 internet calls a week to 2-3 a day. I text them when I need something changed and it just gets done. No tickets, no waiting.',
  },
  {
    name: 'Sarah Chen',
    business: 'Precision Auto Works',
    role: 'General Manager',
    color: 'bg-emerald-500',
    quote:
      "We had nothing online. Now we're the top search result in our area. The site paid for itself in the first month from new customers alone.",
  },
]
