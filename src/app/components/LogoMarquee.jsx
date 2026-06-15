import {
  Building2,
  Car,
  ChefHat,
  Hammer,
  Heart,
  Scale,
  Scissors,
  Stethoscope,
  Store,
  Wrench,
} from 'lucide-react'

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
    <section className="overflow-hidden border-t border-gray-200 bg-surface-base py-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-gray-400">
          Industries I Serve
        </p>
      </div>
      <div className="marquee-fade">
        <div className="animate-marquee flex gap-6 sm:gap-12">
          {DOUBLED.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={i}
                className="flex flex-shrink-0 items-center gap-2.5 text-gray-400 transition-colors hover:text-gray-600"
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                <span className="whitespace-nowrap text-sm font-medium">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
