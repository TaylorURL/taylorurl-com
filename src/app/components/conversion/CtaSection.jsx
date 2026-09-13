import CtaBand, { CtaButton } from '@components/conversion/CtaBand'

/**
 * The closing call to action for a page with one thing to do next, so the
 * button is fixed at /start rather than passed in. `@components/CtaBanner` is
 * the same band with addressable buttons, for pages that offer a choice.
 *
 * `title` takes a node rather than a string because most callers wrap part of
 * the heading in an accent gradient.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.title - Heading content.
 * @param {string} props.description - Supporting line beside the button.
 * @param {string} [props.eyebrow] - Standing label above the heading.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the band
 *   sits on.
 */
export default function CtaSection({ title, description, eyebrow, ground }) {
  return (
    <CtaBand title={title} description={description} eyebrow={eyebrow} ground={ground}>
      <CtaButton to="/start">Start a Project</CtaButton>
    </CtaBand>
  )
}
