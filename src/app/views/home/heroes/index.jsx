import HeroSheet from './HeroSheet'
import HeroArtboard from './HeroArtboard'
import HeroSeam from './HeroSeam'
import HeroWorkOrder from './HeroWorkOrder'

/**
 * The four presentations the homepage hero rotates through, in the order it
 * shows them.
 *
 * `HERO_OPENER_ID` names the one every visit opens on. The opener is the
 * strongest reading of the offer and the frame the prerendered HTML already
 * carries, so pinning it means the first thing a visitor sees is both chosen
 * and identical to what arrived before the bundle did.
 *
 * All four stand on the ground the setting chose, so the control reaches the
 * first screen a visitor sees, and so the rail that rides above them - which
 * lives outside their sections - takes the same ink they do without being told
 * which presentation is showing. The sheets they carry inside, which stand for
 * finished websites, name a ground of their own.
 */
export const HERO_VARIANTS = [
  { id: 'sheet', name: 'Sheet', Component: HeroSheet },
  { id: 'artboard', name: 'Artboard', Component: HeroArtboard },
  { id: 'seam', name: 'Seam', Component: HeroSeam },
  { id: 'work-order', name: 'Work Order', Component: HeroWorkOrder },
]

/**
 * The presentation every visit opens on. The other three shuffle behind it, so
 * a second visit differs without the opening frame ever being left to a draw.
 */
export const HERO_OPENER_ID = 'seam'
