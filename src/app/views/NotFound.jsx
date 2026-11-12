import { Button, Container, PhoneButton } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import Seo from '@components/Seo'
import { IS_SECOND_SITE } from '../../../lib/site/current.js'

/**
 * What the page tells a crawler it is.
 *
 * `noIndex` is on, so this is read by a reader who opened the source or a tool
 * that ignores the directive rather than by search - which is exactly why it
 * cannot be the other site's offer. The rest of the page says nothing about
 * what is sold here and needs no second version.
 */
const DESCRIPTION = IS_SECOND_SITE
  ? 'That page is not here. Head back to the home page for software built to order, conversion tracking repaired, and outbound email run for you.'
  : 'That page is not here. Head back to the home page for websites, redesigns, hosting, and local search work for Baytown and Houston businesses.'

/**
 * The page for an address with nothing at it. The reader arrived by mistake,
 * so it says so in a line and offers the two ways on: the home page, or the
 * phone.
 */
export default function NotFound() {
  return (
    <section className="wa-hero-band flex min-h-[calc(100dvh-var(--nav-height,64px)-2rem)] items-center py-16 sm:py-24">
      <Seo title="Page Not Found" description={DESCRIPTION} path="/404" noIndex />
      <Container className="text-center">
        <h1 className={TYPE.display}>Nothing is at this address.</h1>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button to="/" className="w-full sm:w-auto">
            Go Home
          </Button>
          <PhoneButton className="w-full sm:w-auto" />
        </div>
      </Container>
    </section>
  )
}
