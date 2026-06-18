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
        description="TaylorURL is Trenton Taylor, an independent developer building modern websites and JavaScript applications for local businesses in Baytown, Houston, and the surrounding area. Hand-coded React. Direct relationship. Ongoing support after launch."
      />
      <div id="hero">
        <HeroSection />
      </div>
      <SocialProofCounter />
      <TrustBadgesSection />
      <LogoMarquee />
      <div id="stats">
        <StatsSection />
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
