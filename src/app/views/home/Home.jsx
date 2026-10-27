import Seo from '@components/Seo'
import HomeBoard from './board/HomeBoard'
import HeroLines from './heroes/HeroLines'
import ServiceLinesSection from './ServiceLinesSection'
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
 * The studio's home is one board (`./board/HomeBoard`): the offer and the way
 * in, then the proof an owner skimming for ten seconds needs, all on roughly
 * one screen. It replaced six scrolling bands because the people it is for do
 * not read a long page; they look for what is sold, whether it is any good,
 * and how to ask.
 *
 * The second site keeps its four bands. It sells work to order under another
 * name and has none of what the board is built from - no portfolio of its own
 * and no reviews it can claim - so a board there would be the studio's proof
 * standing on someone else's page. Its bands are one component each, told what
 * to say.
 */
export default function Home() {
  if (!IS_SECOND_SITE) {
    return (
      <>
        <Seo path="/" />
        <HomeBoard />
      </>
    )
  }

  return (
    <div>
      <Seo path="/" />
      <div id="hero">
        <HeroLines />
      </div>
      <div id="capabilities">
        <ServiceLinesSection />
      </div>
      <div id="how">
        <HowItWorksSection />
      </div>
      <div id="cta">
        <FinalCtaSection />
      </div>
    </div>
  )
}
