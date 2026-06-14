import { motion } from 'framer-motion'
import { CheckCircle2, MapPin, Headphones } from 'lucide-react'
import { fadeInUp } from '@constants/animations'

const TRUST_BADGES = [
  { label: '100+ Projects Delivered', icon: CheckCircle2 },
  { label: 'Baytown Based', icon: MapPin },
  { label: '24/7 Support', icon: Headphones },
]

export default function TrustBadgesSection() {
  return (
    <section className="border-y border-gray-200 bg-surface-base py-8">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          {...fadeInUp}
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
        >
          {TRUST_BADGES.map(badge => {
            const Icon = badge.icon
            return (
              <div key={badge.label} className="flex items-center gap-2 text-sm text-gray-500">
                <Icon className="h-4 w-4 text-gray-400" />
                {badge.label}
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
