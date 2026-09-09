import {
  BBB_PROFILE_URL,
  BBB_SEAL_HEIGHT,
  BBB_SEAL_RADIUS,
  BBB_SEAL_SRC,
  BBB_SEAL_WIDTH,
  bbbAccredited,
} from '@data/reputation/bbb'

/**
 * The BBB Accredited Business seal, wherever the site says so.
 *
 * One component rather than markup repeated per surface, because the seal is
 * licensed artwork rather than decoration: BBB issues it on the condition it is
 * shown whole, unaltered and against the profile it was granted for, and a rule
 * that has to be re-obeyed in five files is a rule that eventually is not. The
 * whole of the obligation is held here, so a page asks for the seal and gets a
 * compliant one.
 *
 * It is drawn on a white tile in both settings rather than on the ground. It is
 * BBB's artwork, made for a light ground and carrying its own lettering and its
 * own blue, and a mark like that on the dark setting's near-black field is a
 * silhouette of itself. The tile is the same answer the review cards give a
 * client logo.
 *
 * The tile hugs the artwork rather than framing it, and it is cut to the same
 * corner. BBB draws the lockup on its own white panel behind its own keyline,
 * so any tile wider than the file is white the seal did not ask for - and under
 * the dark setting that surplus is the brightest thing on the page, a lit slab
 * in the quietest line of the footer, where every neighbour is a hairline or
 * faint grey. Hugging leaves only the white BBB itself put in the file: the
 * mark keeps the ground it was drawn for, and the page stops carrying a lamp
 * for it. Under the light setting the tile was never visible against paper, so
 * nothing there changes.
 *
 * It links to the profile it was issued against, which is the whole of what a
 * seal is for: the one mark on a page whose job is being checkable. Nothing
 * draws unless the artwork BBB issued is held, so no surface can ship a badge
 * that goes nowhere or a claim the source refuses.
 *
 * @param {object} props
 * @param {number} [props.width] - How wide the artwork is drawn, in pixels. The
 *   file's own proportions are kept whatever this is, because the licence is on
 *   the artwork rather than on a size of it.
 * @param {string} [props.className] - Classes for the tile, for a caller that
 *   has to place it in its own layout.
 */
export default function BbbSeal({ width = 128, className = '' }) {
  if (!bbbAccredited()) return null

  return (
    <a
      href={BBB_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`border-hair inline-flex w-fit border bg-white transition-colors duration-200 hover:border-[color:var(--bbb-blue)] ${className}`.trimEnd()}
      style={{ borderRadius: `${(width * BBB_SEAL_RADIUS) / BBB_SEAL_WIDTH}px` }}
    >
      <img
        src={BBB_SEAL_SRC}
        alt="TaylorURL LLC is a BBB Accredited Business"
        width={BBB_SEAL_WIDTH}
        height={BBB_SEAL_HEIGHT}
        loading="lazy"
        decoding="async"
        className="block h-auto"
        style={{ width: `${width}px` }}
      />
    </a>
  )
}
