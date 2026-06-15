import Seo from '@components/Seo'
import LogoMarquee from '@components/LogoMarquee'
import SocialProofCounter from '@components/SocialProofCounter'
import HeroSection from './home/HeroSection'
import TrustBadgesSection from './home/TrustBadgesSection'
import StatsSection from './home/StatsSection'
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
        description="TaylorURL is Trenton Taylor — a solo developer building modern websites and JavaScript applications for local businesses. Shops, restaurants, trades, contractors, and independent professionals in Baytown, Houston, and the surrounding community. Direct relationship with the developer. Real code. No template-y agency feel."
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
