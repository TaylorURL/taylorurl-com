import Seo from '@components/Seo'
import HeroSection from './HeroSection'
import HeroLines from './heroes/HeroLines'
import CapabilitiesSection from './CapabilitiesSection'
import ServiceLinesSection from './ServiceLinesSection'
import TestimonialsSection from './TestimonialsSection'
import HowItWorksSection from './HowItWorksSection'
import FinalCtaSection from './FinalCtaSection'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * The home page, for whichever site is building.
 *
 * The head is not set here. `SITE.head.homeTitle` and `SITE.head.description`
 * are what `@components/Seo` falls back to when a page names neither, and the
 * registry already carries a title and a description per site, so `/` takes its
 * own without this view knowing which one it is.
 *
 * Three of the five bands differ, and one does not run at all.
 *
 * The hero and the second band change component rather than copy. The studio's
 * hero rotates four presentations of one offer and its second band is a wall of
 * artefacts - a client's site, a measured score, the board that watches them -
 * and the second site has one offer in three lines and none of those artefacts.
 * Rewording either would have left the shape of a page arguing for something
 * else.
 *
 * The reviews do not run on the second site at all. `CLIENT_REVIEW_LIST` is the
 * studio's clients writing about the studio, and `SITE.reviews` is already
 * false on the other record for the same reason the BBB seal and the review
 * schema are cut there: a second domain publishing them claims a reputation
 * nobody left under that name. There is nothing to put in its place, because
 * anything put there would be the invention the gate exists to prevent.
 *
 * The last two bands are one component each, told what to say. Both pages run
 * three steps and close on a single call, so the layout holds and only the
 * words and the destination move.
 */
export default function Home() {
  return (
    <div>
      <Seo path="/" />
      <div id="hero">{IS_SECOND_SITE ? <HeroLines /> : <HeroSection />}</div>
      <div id="capabilities">
        {IS_SECOND_SITE ? <ServiceLinesSection /> : <CapabilitiesSection />}
      </div>
      {IS_SECOND_SITE ? null : (
        <div id="testimonials">
          <TestimonialsSection />
        </div>
      )}
      <div id="how">
        <HowItWorksSection />
      </div>
      <div id="cta">
        <FinalCtaSection />
      </div>
    </div>
  )
}
