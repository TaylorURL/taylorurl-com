import Seo from '@components/Seo'
import HeroSection from './home/HeroSection'
import WhyWebsiteSection from './home/WhyWebsiteSection'
import DataSection from './home/DataSection'
import TestimonialsSection from './home/TestimonialsSection'
import HowItWorksSection from './home/HowItWorksSection'
import NewsletterSection from './home/NewsletterSection'
import FinalCtaSection from './home/FinalCtaSection'

export default function Home() {
  return (
    <div>
      <Seo
        path="/"
        description="Baytown, TX web developer building hand-coded React websites and JavaScript apps for shops, restaurants, trades, and pros across the Houston area."
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
    </div>
  )
}
