import { lazy, Suspense } from 'react'
import Seo from '@components/Seo'
import HeroSection from './home/HeroSection'
import WhyWebsiteSection from './home/WhyWebsiteSection'
import DataSection from './home/DataSection'
import TestimonialsSection from './home/TestimonialsSection'
import HowItWorksSection from './home/HowItWorksSection'
import NewsletterSection from './home/NewsletterSection'
import FinalCtaSection from './home/FinalCtaSection'

// Email popup hides itself for the first six seconds anyway, so its bundle
// has no reason to be in the home critical path.
const EmailCapturePopup = lazy(() => import('@components/EmailCapturePopup'))

export default function Home() {
  return (
    <div>
      <Seo
        path="/"
        description="Baytown, TX web designer building custom websites for shops, restaurants, trades, and local pros across the Houston area. Show up on Google. Bring in more customers."
      />
      <div id="hero">
        <HeroSection />
      </div>
      <div id="why">
        <WhyWebsiteSection />
      </div>
      <div id="data">
        <DataSection />
      </div>
      <div id="testimonials">
        <TestimonialsSection />
      </div>
      <div id="how">
        <HowItWorksSection />
      </div>
      <NewsletterSection />
      <div id="cta">
        <FinalCtaSection />
      </div>
      <Suspense fallback={null}>
        <EmailCapturePopup />
      </Suspense>
    </div>
  )
}
