/**
 * A wrapper that used to fade its contents in the first time they were
 * scrolled to.
 *
 * The redesign has no arrival motion: everything on a page is there the moment
 * the page is, because a headline that waits for a script to show it is a
 * headline some readers never see. The component stays as a plain element so
 * the places that wrap a band in it keep their markup.
 */
export default function Reveal({ as: Tag = 'div', children, className = '' }) {
  return <Tag className={className || undefined}>{children}</Tag>
}
