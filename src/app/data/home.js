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
    title: 'Show up on Google',
    description:
      'When someone searches for what you do, the businesses that come up are the ones with a real website. No website, no chance of being picked.',
    icon: Search,
  },
  {
    title: 'Open after you close',
    description:
      'Your website answers questions, takes messages, and accepts bookings overnight and on weekends. It keeps working when you can’t.',
    icon: Clock,
  },
  {
    title: 'Look the part',
    description:
      'People check you out before they call. A clean, well-built site tells them you’re the real deal and worth picking up the phone for.',
    icon: Shield,
  },
  {
    title: 'Reach new customers',
    description:
      'Word of mouth only goes so far. A website puts you in front of people who’ve never heard your name but are ready to spend.',
    icon: Users,
  },
  {
    title: 'Works on every phone',
    description:
      'Most people search on a phone. If your site is slow or hard to use there, they tap back and call the next name on the list.',
    icon: Smartphone,
  },
  {
    title: 'Pays for itself',
    description:
      'One or two extra jobs usually covers the whole site. Everything after that goes straight to your bottom line.',
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
      'I get to work and show you progress as I go. You can give feedback any time. No drawn-out timelines and no surprises at the end.',
  },
  {
    step: '3',
    title: 'Go live',
    description:
      'Your site goes live. I keep it online, fast, and safe so you can stay focused on running the business.',
  },
]

export const HERO_BADGES = ['Cancel anytime', 'Free initial call']

export const CLIENT_TESTIMONIALS = [
  {
    name: 'Maria Rodriguez',
    business: 'Rodriguez Family Restaurant',
    role: 'Owner',
    color: 'bg-orange-500',
    quote:
      'He just handles it. I don’t know anything about websites and I don’t want to. Online orders are up about 40% since launch and I haven’t had to learn a thing.',
  },
  {
    name: 'James Mitchell',
    business: 'Mitchell Plumbing & HVAC',
    role: 'Owner',
    color: 'bg-blue-600',
    quote:
      'Went from a couple of website calls a week to a couple a day. I text Trenton when I need something changed and it just gets done. No tickets, no waiting.',
  },
  {
    name: 'Sarah Chen',
    business: 'Precision Auto Works',
    role: 'General Manager',
    color: 'bg-emerald-500',
    quote:
      'We had nothing online before. Now we’re one of the first names that shows up in our area. The site paid for itself the first month from new customers alone.',
  },
]
