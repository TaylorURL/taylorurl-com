import BlockHead from './BlockHead'
import { GROUND } from '../lib/ground'
import { BRAND_STATES, FEEL_LIMIT, FEELINGS, PHOTO_STATES, VOICE_STEPS } from '../lib/look'

const CELL_FOCUS =
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2'

const CHECKED =
  'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] peer-focus-visible:outline-[color:var(--on-accent)]'
const UNCHECKED =
  'bg-paper text-ink-paper hover:bg-[color:var(--wash-paper)] peer-focus-visible:outline-accent'

/**
 * One answer, drawn as a cell of its question's mesh. The input is taken out
 * of the flow and the cell beside it takes the checked and focused treatment,
 * which keeps the hit area the whole cell.
 */
function OptionCell({ type, group, option, checked, disabled, onPick }) {
  return (
    <label
      className={`relative flex ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${GROUND.cell}`}
    >
      <input
        type={type}
        name={group}
        value={option.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onPick(option.id)}
        className="peer sr-only"
      />
      <span
        className={`${CELL_FOCUS} flex min-h-[56px] w-full items-center p-5 text-[14px] leading-snug transition duration-200 ease-out-soft ${
          checked ? CHECKED : UNCHECKED
        } ${disabled ? 'opacity-40' : ''}`}
      >
        {option.name}
      </span>
    </label>
  )
}

/**
 * One question: its ruled head, and its answers on the mesh the rest of the
 * configurator is laid out on. The fieldset is named by the head's own
 * heading, so the group carries one accessible name.
 */
function Question({ id, label, meta, columns, children }) {
  return (
    <fieldset aria-labelledby={id} className="m-0 border-0 p-0">
      <BlockHead id={id} label={label} meta={meta} />
      <div className={GROUND.shell}>
        <div className={`${GROUND.mesh} ${columns}`}>{children}</div>
      </div>
    </fieldset>
  )
}

/**
 * The look step: what a first draft needs before anything is drawn.
 *
 * Four questions answered with a tap and one box for the thing a list cannot
 * hold. The feeling takes several answers up to `FEEL_LIMIT`, since a
 * direction is the overlap between a few words rather than one of them; past
 * the limit the untaken options go quiet rather than moving, so the answers
 * already given stay where they were put.
 *
 * @param {{ look: object, onToggleFeel: (id: string) => void,
 *   onChoose: (key: string, id: string) => void,
 *   onNotesChange: (event: object) => void }} props
 */
export default function LookSection({ look, onToggleFeel, onChoose, onNotesChange }) {
  const atLimit = look.feels.length >= FEEL_LIMIT

  return (
    <div className="flex flex-col gap-16">
      <Question
        id="feel-head"
        label="How It Should Feel"
        meta={`Pick up to ${FEEL_LIMIT}`}
        columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEELINGS.map(option => {
          const checked = look.feels.includes(option.id)
          return (
            <OptionCell
              key={option.id}
              type="checkbox"
              group="feel"
              option={option}
              checked={checked}
              disabled={!checked && atLimit}
              onPick={onToggleFeel}
            />
          )
        })}
      </Question>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Question
          id="brand-head"
          label="Logo and Colors"
          meta="What the business has today"
          columns="grid-cols-1"
        >
          {BRAND_STATES.map(option => (
            <OptionCell
              key={option.id}
              type="radio"
              group="brand"
              option={option}
              checked={look.brand === option.id}
              onPick={id => onChoose('brand', id)}
            />
          ))}
        </Question>

        <Question
          id="photos-head"
          label="Photographs"
          meta="Of the work itself"
          columns="grid-cols-1"
        >
          {PHOTO_STATES.map(option => (
            <OptionCell
              key={option.id}
              type="radio"
              group="photos"
              option={option}
              checked={look.photos === option.id}
              onPick={id => onChoose('photos', id)}
            />
          ))}
        </Question>
      </div>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Question
          id="voice-head"
          label="How It Reads"
          meta="Plain to formal"
          columns="grid-cols-1 sm:grid-cols-3"
        >
          {VOICE_STEPS.map(option => (
            <OptionCell
              key={option.id}
              type="radio"
              group="voice"
              option={option}
              checked={look.voice === option.id}
              onPick={id => onChoose('voice', id)}
            />
          ))}
        </Question>

        <div>
          <BlockHead id="notes-head" label="Sites to Look At" meta="A link is enough" />
          <textarea
            id="look-notes"
            name="notes"
            aria-labelledby="notes-head"
            rows={4}
            value={look.notes}
            onChange={onNotesChange}
            className="field resize-none py-3.5"
            placeholder="Paste a link to one you like, or name a business whose site you would hate to look like."
          />
        </div>
      </div>
    </div>
  )
}
