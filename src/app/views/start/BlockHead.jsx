import { BLOCK_LABEL, BLOCK_META, GROUND } from './lib/ground'

/**
 * The ruled head a block inside a step opens with: what the block is on the
 * left, what it is scoped to on the right.
 *
 * @param {{ id?: string, label: string, meta?: string }} props
 */
export default function BlockHead({ id, label, meta }) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-3 ${GROUND.rule}`}
    >
      <h3 id={id} className={BLOCK_LABEL}>
        {label}
      </h3>
      {meta && <span className={BLOCK_META}>{meta}</span>}
    </div>
  )
}
