import ServiceSection from './ServiceSection'
import ServiceCards from './ServiceCards'

/**
 * The band a service page closes on before its call to action: everything else
 * on offer, as cards that open their own pages.
 *
 * @param {{ pages: Array<object> }} props - Every service page but the one
 *   drawing the band.
 */
export default function MoreServices({ pages }) {
  return (
    <ServiceSection
      id="more"
      ground="paper"
      eyebrow="The Rest of It"
      title="Everything else on offer."
    >
      <ServiceCards pages={pages} ground="paper" columns={{ base: 1, sm: 2, lg: 3 }} />
    </ServiceSection>
  )
}
