import { CELL_FOCUS, GROUNDS } from '@constants/grounds'
import { meshLadder, meshLayout } from '@constants/mesh'
import { TOOL_NOTE } from '@data/towns-and-trades/trades'

const MARK_CELL =
  'flex h-full w-full items-center gap-3.5 p-5 transition duration-200 ease-out-soft'

const NAME_CHIP =
  'inline-flex min-h-[44px] items-center rounded-[var(--r-control)] border px-3.5 text-[13px] leading-snug transition duration-200 ease-out-soft'

/**
 * One product whose vendor publishes a mark, drawn as the mark and the name it
 * belongs to.
 */
function MarkCell({ tool, tone, cell, checked, onToggle }) {
  const Mark = tool.mark

  if (!onToggle) {
    return (
      <li className={`${tone.surface} ${cell}`}>
        <span className={`${MARK_CELL} ${tone.title}`}>
          <Mark className="h-6 w-6 flex-shrink-0 text-accent" aria-hidden="true" />
          <span className="text-[13px] font-medium leading-snug">{tool.name}</span>
        </span>
      </li>
    )
  }

  return (
    <li className={cell}>
      <label className="relative flex w-full cursor-pointer">
        <input
          type="checkbox"
          name="tools"
          value={tool.id}
          checked={checked}
          onChange={() => onToggle(tool.id)}
          className="peer sr-only"
        />
        <span
          className={`${MARK_CELL} ${CELL_FOCUS} ${
            checked
              ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] peer-focus-visible:outline-[color:var(--on-accent)]'
              : `${tone.surface} ${tone.title} ${tone.wash} peer-focus-visible:outline-[color:var(--accent)]`
          }`}
        >
          <Mark
            className={`h-6 w-6 flex-shrink-0 ${checked ? '' : 'text-accent'}`}
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium leading-snug">{tool.name}</span>
        </span>
      </label>
    </li>
  )
}

/**
 * One product identified by its name alone, set as type rather than as a cell
 * waiting for a mark that is never coming. An entry naming a capability rather
 * than a company is quieter again.
 */
function NameChip({ tool, tone, checked, onToggle }) {
  const quiet = tool.generic
  const resting = quiet
    ? `${tone.rule} ${tone.meta}`
    : `${tone.ruleStrong} ${tone.title} font-medium`

  if (!onToggle) {
    return (
      <li>
        <span className={`${NAME_CHIP} cursor-default ${resting}`}>{tool.name}</span>
      </li>
    )
  }

  return (
    <li>
      <label className="relative flex cursor-pointer">
        <input
          type="checkbox"
          name="tools"
          value={tool.id}
          checked={checked}
          onChange={() => onToggle(tool.id)}
          className="peer sr-only"
        />
        <span
          className={`${NAME_CHIP} ${CELL_FOCUS} ${
            checked
              ? 'border-transparent bg-[color:var(--accent-fill)] font-medium text-[color:var(--on-accent)] peer-focus-visible:outline-[color:var(--on-accent)]'
              : `${resting} ${tone.wash} peer-focus-visible:outline-[color:var(--accent)]`
          }`}
        >
          {tool.name}
        </span>
      </label>
    </li>
  )
}

/**
 * The software a trade already runs, in one panel of two grains.
 *
 * A product is either a mark or a name, and the two are set as what they are:
 * the products whose vendor publishes a mark are drawn on a ruled mesh with it,
 * and the rest run underneath as a band of names, close-set, with the entries
 * naming a capability rather than a company quieter still. Nothing stands in
 * for a mark that does not exist.
 *
 * The same panel answers on a page and in the configurator; handed a toggle, it
 * draws every product as a control instead.
 *
 * @param {object} props
 * @param {Array<object>} props.tools - Resolved entries from `toolsForTrade`.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the panel sits on.
 * @param {string[]} [props.chosen] - Ids of the products already ticked.
 * @param {(id: string) => void} [props.onToggle] - Ticks a product. Left out,
 *   the panel is read rather than answered.
 * @param {string} [props.note] - The sentence set under the panel. It defaults
 *   to the one about the software a trade already runs, which is what every
 *   panel drawn from `TOOLS` is saying. A panel listing something else - an
 *   advertising account rather than a shop's own software - says what its own
 *   list means instead, because the note is the page's claim about the names
 *   above it and a claim about the wrong names is worse than none.
 */
export default function ToolMesh({ tools, ground = 'paper', chosen = [], onToggle, note }) {
  const tone = GROUNDS[ground]
  const marked = tools.filter(tool => tool.mark)
  const plain = tools.filter(tool => !tool.mark && !tool.generic)
  const capabilities = tools.filter(tool => !tool.mark && tool.generic)
  const named = [...plain, ...capabilities]
  const layout = meshLayout(marked.length, meshLadder(marked.length, 'compact'))
  const last = marked.length - 1

  return (
    <div>
      <div {...tone.attrs} className={tone.shell}>
        {marked.length > 0 && (
          <ul className={`${tone.mesh} ${layout.columns}`}>
            {marked.map((tool, index) => (
              <MarkCell
                key={tool.id}
                tool={tool}
                tone={tone}
                cell={`${tone.cell}${index === last && layout.fill ? ` ${layout.fill}` : ''}`}
                checked={chosen.includes(tool.id)}
                onToggle={onToggle}
              />
            ))}
          </ul>
        )}

        {named.length > 0 && (
          <ul
            className={`flex flex-wrap gap-2 border-t p-5 ${tone.rule} ${tone.surface} ${
              marked.length > 0 ? '' : 'border-t-0'
            }`}
          >
            {named.map(tool => (
              <NameChip
                key={tool.id}
                tool={tool}
                tone={tone}
                checked={chosen.includes(tool.id)}
                onToggle={onToggle}
              />
            ))}
          </ul>
        )}
      </div>

      <p className={`mt-5 max-w-2xl text-[14px] leading-relaxed ${tone.body}`}>
        {note || TOOL_NOTE}
      </p>
    </div>
  )
}
