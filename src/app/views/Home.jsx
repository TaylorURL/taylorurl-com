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
        description="TaylorURL builds custom websites for businesses in Baytown, Houston, Pasadena, Deer Park, La Porte, and the greater Houston TX area. No templates. No page builders. Real code that ranks on Google."
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
