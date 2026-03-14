import { motion } from 'framer-motion'
import { Building2, Car, ChefHat, Hammer, Heart, Scale, Scissors, Stethoscope, Store, Wrench } from 'lucide-react'

const INDUSTRIES = [
  { icon: Store, label: 'Retail' },
  { icon: ChefHat, label: 'Restaurants' },
  { icon: Wrench, label: 'Plumbing' },
  { icon: Car, label: 'Auto Repair' },
  { icon: Scissors, label: 'Salons' },
  { icon: Heart, label: 'Non-Profits' },
  { icon: Scale, label: 'Law Firms' },
  { icon: Stethoscope, label: 'Healthcare' },
  { icon: Hammer, label: 'Construction' },
  { icon: Building2, label: 'Real Estate' },
]

const DOUBLED = [...INDUSTRIES, ...INDUSTRIES]

export default function LogoMarquee() {
  return (
    <section className="border-t border-gray-200 bg-white py-10 overflow-hidden">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-gray-400">
          Industries We Serve
        </p>
      </div>
      <div className="marquee-fade">
        <motion.div
          className="flex gap-12"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        >
          {DOUBLED.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={i}
                className="flex flex-shrink-0 items-center gap-2.5 text-gray-400 transition-colors hover:text-gray-600"
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
