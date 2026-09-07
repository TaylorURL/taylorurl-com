import { GROUNDS } from '@constants/grounds'
import { meshLadder, meshLayout } from '@constants/mesh'

/**
 * A ruled mesh: a clipping shell holding one bordered cell per item.
 *
 * The columns come from the item count unless a ladder is named, and the last
 * cell carries whatever span closes the final row, so a mesh never ends on an
 * empty box.
 *
 * @param {object} props
 * @param {Array<*>} props.items - What the mesh lays out, one cell each.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the mesh sits on.
 * @param {Record<string, number>} [props.columns] - Columns per breakpoint, as
 *   `{ base: 1, sm: 2, lg: 3 }`, for a mesh whose density is a design decision
 *   rather than a division of the count.
 * @param {'compact' | 'card' | 'feature'} [props.scale] - How much room a cell
 *   needs, which is what the columns are chosen from when none are named.
 * @param {'div' | 'ul'} [props.as] - The element holding the cells.
 * @param {string} [props.className] - Extra classes for the shell.
 * @param {(item: *, index: number, cell: string) => React.ReactNode}
 *   props.children - Draws one cell. `cell` carries the rules that cell draws
 *   and, on the last one, the span that closes the row.
 */
export default function Mesh({
  items,
  ground = 'paper',
  columns,
  scale = 'compact',
  as = 'div',
  className = '',
  children,
}) {
  const Tag = as
  const tone = GROUNDS[ground]
  const layout = meshLayout(items.length, columns || meshLadder(items.length, scale))
  const last = items.length - 1

  return (
    <div {...tone.attrs} className={`${tone.shell} ${className}`.trimEnd()}>
      <Tag className={`${tone.mesh} ${layout.columns}`}>
        {items.map((item, index) =>
          children(
            item,
            index,
            `${tone.cell}${index === last && layout.fill ? ` ${layout.fill}` : ''}`
          )
        )}
      </Tag>
    </div>
  )
}
