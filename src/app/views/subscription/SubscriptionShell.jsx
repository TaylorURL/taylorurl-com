import { Button, Container } from '@components/kit/Kit'
import { CARD, TYPE } from '@components/kit/styles'
import { useAnnounceGround } from '@hooks/theme/useOnDarkBackground'

/**
 * The frame both list pages report into.
 *
 * A page reached from a link in an email carries one fact and two ways onward,
 * so it is one card at a reading measure on the page's glow: the heading, a
 * line of detail, anything the reader still has to do, and the two pills.
 *
 * @param {object} props
 * @param {string} props.heading
 * @param {string} [props.body] - one line of detail, omitted while working
 * @param {import('react').ReactNode} [props.children] - what the reader still
 *   has to do, set between the detail and the two ways onward
 */
export default function SubscriptionShell({ heading, body, children }) {
  useAnnounceGround()

  return (
    <section data-ground="dark" className="glow">
      <Container narrow className="flex min-h-[calc(100dvh-80px)] items-center py-12 sm:py-20">
        <div className={`${CARD} w-full p-6 sm:p-10`}>
          <h1 className={TYPE.h2}>{heading}</h1>
          {body && <p className={`${TYPE.body} mt-3 max-w-xl`}>{body}</p>}
          {children}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button to="/" className="w-full sm:w-auto">
              Return to Home
            </Button>
            <Button to="/contact" variant="secondary" className="w-full sm:w-auto">
              Get in Touch
            </Button>
          </div>
        </div>
      </Container>
    </section>
  )
}
