import { Link } from 'react-router-dom'
import CtaBand, { CtaButton } from '@components/conversion/CtaBand'
import { AccentGradient } from '@reactbits/kit'

/**
 * The closing call to action for a page that offers a choice: both buttons are
 * addressable, so a service page can send a reader to the inquiry or across to
 * pricing. `@components/CtaSection` is the same band with one fixed button, for
 * pages where there is only one thing to do next.
 *
 * @param {object} props
 * @param {string} props.heading - The heading, up to the accent.
 * @param {string} [props.accentText] - The tail of the heading, in the accent
 *   gradient.
 * @param {string} props.description - Supporting line beside the buttons.
 * @param {string} [props.primaryLabel] - Label for the leading button.
 * @param {string} [props.primaryTo] - Where the leading button goes.
 * @param {string} [props.secondaryLabel] - Label for the second button. Left
 *   out, the band closes on one.
 * @param {string} [props.secondaryTo] - Where the second button goes.
 * @param {string} [props.eyebrow] - Standing label above the heading.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the band
 *   sits on. A dark slab carries the aurora.
 */
export default function CtaBanner({
  heading,
  accentText,
  description,
  primaryLabel = 'Start a Project',
  primaryTo = '/start',
  secondaryLabel,
  secondaryTo,
  eyebrow,
  ground,
}) {
  return (
    <CtaBand
      title={
        <>
          {heading}
          {accentText && (
            <>
              {' '}
              <AccentGradient>{accentText}</AccentGradient>
            </>
          )}
        </>
      }
      description={description}
      eyebrow={eyebrow}
      ground={ground}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CtaButton to={primaryTo}>{primaryLabel}</CtaButton>
        {secondaryLabel && secondaryTo && (
          <Link to={secondaryTo} className="btn btn-secondary">
            {secondaryLabel}
          </Link>
        )}
      </div>
    </CtaBand>
  )
}
