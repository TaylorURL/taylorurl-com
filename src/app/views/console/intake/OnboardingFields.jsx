import { useRef, useState } from 'react'
import { CONTROL_H, FIELD, MONO_LABEL, QUIET, SELECT } from '../lib/tokens'
import { DAY_NAMES } from '../lib/onboarding'
import OnboardingWriting from './OnboardingWriting'

/**
 * One question off the brief, drawn as whatever that question actually wants.
 *
 * The brief asks for a paragraph about the business, a phone number, a set of
 * towns, seven rows of opening hours and a logo, and the only thing those have
 * in common is that a client answers them. So `kind` chooses the control, the
 * same way it does on the tracker, rather than every question getting a text
 * box with a sentence under it explaining what to type in. A question asked
 * with the right control is one that cannot be answered wrongly: a set of
 * towns cannot arrive as a line nobody can split, and a closed Sunday cannot
 * arrive as the word closed in a time field.
 *
 * Nothing here decides whether an answer counts. `lib/onboarding.js` holds the
 * catalogue and the whole of the arithmetic over it, and the database re-checks
 * the required paths before it accepts a submission. A control that also held
 * an opinion would be a third reading of the same question, which is how a
 * form comes to refuse what the bar above it says is finished. These draw what
 * they are handed and report every change upward.
 *
 * What the catalogue does not carry is what a column named `closed` or `open`
 * looks like on a screen, because it is plain data read by a check script under
 * bare node and it holds no drawing of any kind. That vocabulary is here, and
 * the split is the right way round: a list is defined there by the columns it
 * has, and a column is defined here by the control it takes.
 *
 * @typedef {object} BriefField
 * @property {string} key The stored path, `brand.tagline`, which is also what
 *   the control's own id is built from.
 * @property {string} kind Which control below draws it.
 * @property {string} label Title Case, and the only heading the question has.
 * @property {string|null} [help] One sentence under the label, sentence case.
 * @property {string} [placeholder]
 * @property {boolean} [required]
 * @property {Array<{id: string, name: string}>|null} [options] choice and
 *   multichoice. A catalogue entry carrying null resolves its own options at
 *   draw time and arrives here with them filled in.
 * @property {number} [max] The most a multichoice takes. `brand.feel` takes 3.
 * @property {string[]} [columns] What one row of a list holds, by name.
 * @property {string[]} [days] On a list, the rows it always has and never adds
 *   to, which is the hours and nothing else.
 * @property {Array<{id: string, name: string}>} [networks] The chooser in a
 *   social row.
 * @property {boolean} [assist] Whether the writing help stands beside the box.
 * @property {(file: File) => unknown} [send] A file field's own writer.
 * @property {(entry: object) => unknown} [remove] and its own remover.
 * @property {boolean} [sending] Whether a file is on its way up.
 * @property {string|null} [acting] Which held file a removal is out for.
 */

/**
 * What a browser may offer for a file question. The same list the tracker
 * offers and the same list the endpoint enforces, because a picker that shows
 * a client a file the bucket will refuse has cost them an upload rather than
 * saved them one.
 */
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'

/**
 * How many answers a choice draws as a list before it becomes a chooser.
 *
 * Three ways a site can read are three lines a client compares at a glance,
 * and a list is the faster read every time. Ten places a web address might be
 * registered is a column of ten radio buttons in the middle of a form, and
 * nobody compares those - they look for their own registrar and press it,
 * which is what a chooser is.
 */
const CHOICE_ROWS = 6

/**
 * The measure a single value is read and typed at.
 *
 * The card fills the column the way every console card does, and a field left
 * to fill it with the card puts a label a hand's width from the box it names.
 * A paragraph is wider than a postcode for the same reason a paragraph is
 * longer.
 */
const MEASURE = 'w-full max-w-[34rem]'
const WIDE = 'w-full max-w-[46rem]'

const LABEL = `${MONO_LABEL} block text-paper-faint`
const HELP = 'mt-1 max-w-[46rem] text-[12px] leading-relaxed text-paper-soft'

/**
 * One option a client presses.
 *
 * A radio and a tick box are the same row with a different input in it, and
 * the browser draws both off `accent-color`, so the row is written once and the
 * type decides what appears in it. The whole row is the label, which is what
 * makes it something a thumb can land on rather than a fifteen pixel square
 * beside some words.
 */
const OPTION =
  'flex cursor-pointer items-start gap-2.5 rounded-[var(--console-radius-sm)] px-2 py-1.5 text-[13px] leading-snug text-ink-paper transition-colors duration-150 ease-out-soft hover:bg-[color:var(--console-row-hover)]'
const OPTION_OFF = 'cursor-not-allowed opacity-50 hover:bg-transparent'
const OPTION_INPUT =
  'mt-[3px] h-[15px] w-[15px] flex-shrink-0 cursor-pointer accent-[color:var(--accent-fill)]'

/** The row's own classes. The closed state changes them rather than a variant. */
const optionRow = off => `${OPTION}${off ? ` ${OPTION_OFF}` : ''}`

/**
 * A short answer already given, as something to read rather than a row to
 * scroll past. A town, a colour and a licence number are each a couple of
 * words, and a column of them at field height is a column of mostly nothing.
 */
const CHIP =
  'inline-flex items-center gap-2 rounded-full border border-hair-paper-strong bg-[color:var(--paper-field)] py-1 pl-3 pr-1.5 text-[13px] text-ink-paper'
const CHIP_DROP =
  'flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-[13px] leading-none text-paper-faint transition-colors duration-150 ease-out-soft hover:text-[color:var(--danger-on-paper)] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * What each column of a list is, by the name the catalogue gives it.
 *
 * `off` names the column in the same row that closes this one: a day marked
 * closed has no opening time, and a form that leaves the two times live beside
 * the tick invites somebody to fill in hours for a day they have just said
 * they are shut. `from` names where a chooser's options come from on the field.
 */
const COLUMNS = {
  day: { heading: 'Day', kind: 'fixed', width: 'w-24', nameOf: id => DAY_NAMES[id] || id },
  closed: { heading: 'Closed', kind: 'tick', width: 'w-auto' },
  open: { heading: 'Opens', kind: 'time', width: 'w-32', off: 'closed' },
  close: { heading: 'Closes', kind: 'time', width: 'w-32', off: 'closed' },
  network: { heading: 'Where', kind: 'choice', width: 'min-w-[9rem] flex-1', from: 'networks' },
  url: { heading: 'Link', width: 'min-w-[13rem] flex-[2]', placeholder: 'https://' },
  title: { heading: 'Page Name', width: 'min-w-[10rem] flex-1' },
  name: { heading: 'Name', width: 'min-w-[10rem] flex-1' },
  price: { heading: 'Price', width: 'min-w-[8rem] flex-1', placeholder: 'from $1,200' },
  note: { heading: 'Notes', width: 'min-w-[12rem] flex-[2]' },
}

const column = key => COLUMNS[key] || { heading: key, width: 'min-w-[10rem] flex-1' }

/** The control's own id, which its label points at and its help is read with. */
const idOf = field => `brief-${field.key.replace(/\./g, '-')}`

/** What a control names as its own description, when it has one. */
const describedBy = field => (field.help ? `${idOf(field)}-help` : undefined)

/** The single-line answers: a name, a phone number, a link. */
function LineField({ field, value, onChange, disabled, type = 'text', mode }) {
  return (
    <input
      id={idOf(field)}
      type={type}
      inputMode={mode}
      className={`${FIELD} mt-1.5 ${MEASURE}`}
      value={value ?? ''}
      disabled={disabled}
      placeholder={field.placeholder}
      aria-describedby={describedBy(field)}
      onChange={event => onChange(event.target.value)}
    />
  )
}

/**
 * A written answer, with the writing help beside it.
 *
 * The help is handed the question's own label rather than its stored key,
 * because what the assistant is told about the box is what a person would be
 * told about it and `ideas.must_have` tells nobody anything.
 *
 * Whether the help stands here is the field's own answer and not the kind's.
 * The line under the business name is eight words and carries it; the sites
 * somebody likes is a paragraph and does not. With nothing to hand it - the
 * assistant unreachable, or a caller that never wired one - the box is the
 * box, and everything a client types still lands in the same place. That is
 * the difference between a writing tool that has an assistant and one that is
 * an assistant.
 */
function WrittenField({ field, value, onChange, disabled, assist, rows = 5 }) {
  if (field.assist && assist) {
    return (
      <div className={`mt-1.5 ${WIDE}`}>
        <OnboardingWriting
          value={value ?? ''}
          onChange={onChange}
          field={field.label}
          trade={assist.trade}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <textarea
      id={idOf(field)}
      className={`${FIELD} console-ask-text mt-1.5 ${WIDE}`}
      rows={rows}
      value={value ?? ''}
      disabled={disabled}
      placeholder={field.placeholder}
      aria-describedby={describedBy(field)}
      onChange={event => onChange(event.target.value)}
    />
  )
}

/** One answer out of a handful, as rows rather than a chooser. */
function ChoiceRows({ field, value, onChange, disabled, options }) {
  return (
    <div
      className="mt-1.5 flex flex-col gap-0.5"
      role="radiogroup"
      aria-labelledby={`${idOf(field)}-label`}
      aria-describedby={describedBy(field)}
    >
      {options.map(option => (
        <label key={option.id} className={optionRow(disabled)}>
          <input
            type="radio"
            className={OPTION_INPUT}
            name={idOf(field)}
            value={option.id}
            checked={value === option.id}
            disabled={disabled}
            onChange={() => onChange(option.id)}
          />
          <span>{option.name}</span>
        </label>
      ))}
    </div>
  )
}

/** The same question past the length a list is read at. */
function ChoiceField({ field, value, onChange, disabled }) {
  const options = field.options || []
  if (options.length <= CHOICE_ROWS) {
    return (
      <ChoiceRows
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={options}
      />
    )
  }
  return (
    <select
      id={idOf(field)}
      className={`${SELECT} mt-1.5 ${MEASURE}`}
      value={value ?? ''}
      disabled={disabled}
      aria-describedby={describedBy(field)}
      onChange={event => onChange(event.target.value)}
    >
      <option value="">Pick one</option>
      {options.map(option => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}

/**
 * Several answers out of a handful.
 *
 * A ceiling is kept by closing the unchosen rows rather than by refusing a
 * press after it has been made, and a closed row says why in its own title. A
 * client who has picked three feelings and reaches for a fourth should learn
 * that three is the limit from the control, not from a message that arrives
 * after they have already decided.
 */
function MultiField({ field, value, onChange, disabled }) {
  const held = Array.isArray(value) ? value : []
  const full = typeof field.max === 'number' && held.length >= field.max
  const note = full ? `Pick up to ${field.max}. Take one out to swap it.` : undefined

  return (
    <div
      className="mt-1.5 flex flex-col gap-0.5"
      role="group"
      aria-labelledby={`${idOf(field)}-label`}
      aria-describedby={describedBy(field)}
    >
      {(field.options || []).map(option => {
        const on = held.includes(option.id)
        const off = disabled || (!on && full)
        return (
          <label key={option.id} className={optionRow(off)} title={!on && full ? note : undefined}>
            <input
              type="checkbox"
              className={OPTION_INPUT}
              checked={on}
              disabled={off}
              onChange={() =>
                onChange(on ? held.filter(id => id !== option.id) : [...held, option.id])
              }
            />
            <span>{option.name}</span>
          </label>
        )
      })}
    </div>
  )
}

/**
 * A list of short answers, each typed and kept.
 *
 * Enter adds, because the towns somebody covers arrive as a burst of typing and
 * reaching for a button between each one is what makes a client stop at three.
 * The button is there as well, for a reader who has never learned that enter
 * does anything, and it is the same act either way.
 *
 * The draft in the box is not an answer until it is added, and a half-typed
 * town left in the field when the client moves on is lost on purpose. A list
 * that quietly kept it would be holding something nobody pressed enter on,
 * which is how Baytow ends up on a page of the finished site.
 */
function ChipsField({ field, value, onChange, disabled }) {
  const held = Array.isArray(value) ? value : []
  const [draft, setDraft] = useState('')

  const add = () => {
    const word = draft.trim()
    setDraft('')
    if (!word || held.includes(word)) return
    onChange([...held, word])
  }

  return (
    <div className={`mt-1.5 ${MEASURE}`}>
      {held.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {held.map(word => (
            <li key={word} className={CHIP}>
              <span>{word}</span>
              <button
                type="button"
                className={CHIP_DROP}
                disabled={disabled}
                aria-label={`Remove ${word}`}
                onClick={() => onChange(held.filter(one => one !== word))}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={idOf(field)}
          type="text"
          className={`${FIELD} flex-1`}
          value={draft}
          disabled={disabled}
          placeholder={field.placeholder || 'Type one and press enter.'}
          aria-describedby={describedBy(field)}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            // The brief closes on a control that hands it over, and enter in a
            // text field is a press of whatever ends the form it is in. Here it
            // means add this one, which is the only thing it can usefully mean
            // in a box somebody is halfway through a list of towns in.
            event.preventDefault()
            add()
          }}
        />
        <button type="button" className={QUIET} disabled={disabled || !draft.trim()} onClick={add}>
          Add
        </button>
      </div>
    </div>
  )
}

/**
 * The files only the client has.
 *
 * The same shape the tracker's own file ask uses, down to the cleared picker: a
 * browser decides nothing changed when the same file is chosen twice, and a
 * control left naming a file that has already gone reads as a file that has
 * not.
 *
 * Sending and removing are carried on the field rather than expressed as a new
 * value, because a file leaves the browser before it is an answer. Everything
 * else here is something the client typed and this is a request that can fail
 * halfway, so it belongs to whoever holds the connection rather than to the
 * control drawing the list.
 */
function FilesField({ field, value, disabled }) {
  const picker = useRef(null)
  const held = Array.isArray(value) ? value : []
  const nameOf = file => file.name || 'Attached file'
  const idFor = file => file.path || file.name

  const choose = async event => {
    const chosen = Array.from(event.target.files || [])
    if (picker.current) picker.current.value = ''
    for (const file of chosen) await field.send?.(file)
  }

  return (
    <div className="console-ask-body mt-1.5">
      {held.length ? (
        <ul className="console-ask-files">
          {held.map(file => (
            <li key={idFor(file)}>
              <span>{nameOf(file)}</span>
              {/* Keyed on the file rather than the field, because a removal in
                  flight is against one file and the picker beside it should
                  stay usable. */}
              <button
                type="button"
                className="console-ask-remove"
                disabled={disabled || field.acting === idFor(file)}
                aria-label={`Remove ${nameOf(file)}`}
                onClick={() => field.remove?.(file)}
              >
                {field.acting === idFor(file) ? 'Removing' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="console-ask-note">Nothing attached yet.</p>
      )}
      <div className="console-ask-actions">
        <input
          ref={picker}
          id={idOf(field)}
          type="file"
          className="console-ask-file"
          accept={ACCEPT}
          multiple
          disabled={disabled || field.sending}
          aria-describedby={describedBy(field)}
          onChange={choose}
        />
        {field.sending ? <span className="console-ask-note">Sending</span> : null}
      </div>
    </div>
  )
}

/** The lines of a postal address, in the order they are written on an envelope. */
const ADDRESS_LINES = [
  { key: 'line1', label: 'Street', span: 'sm:col-span-2' },
  { key: 'line2', label: 'Suite or Unit', span: 'sm:col-span-2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postal', label: 'ZIP Code', mode: 'numeric' },
]

/**
 * Where the business is, or the statement that it is nowhere in particular.
 *
 * The tick is the whole reason this is a kind of its own. A tradesman working
 * out of a truck has no address a customer visits, and a form that reads that
 * as an unfinished answer holds a build up over a fact about the business. Once
 * it is ticked the lines go, because a form that keeps asking a question it has
 * been told does not apply is a form that was not listening.
 */
function AddressField({ field, value, onChange, disabled }) {
  const held = value && typeof value === 'object' ? value : {}
  const none = Boolean(held.none)

  return (
    <div className={`mt-1.5 ${MEASURE}`} aria-describedby={describedBy(field)}>
      <label className={`${optionRow(disabled)} -ml-2 mb-1.5`}>
        <input
          type="checkbox"
          className={OPTION_INPUT}
          checked={none}
          disabled={disabled}
          onChange={event => onChange({ ...held, none: event.target.checked })}
        />
        <span>No address customers visit</span>
      </label>
      {none ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ADDRESS_LINES.map(line => (
            <div key={line.key} className={line.span}>
              <label htmlFor={`${idOf(field)}-${line.key}`} className={LABEL}>
                {line.label}
              </label>
              <input
                id={`${idOf(field)}-${line.key}`}
                type="text"
                inputMode={line.mode}
                className={`${FIELD} mt-1`}
                value={held[line.key] ?? ''}
                disabled={disabled}
                onChange={event => onChange({ ...held, [line.key]: event.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** One cell of a list row, which is a short control with no label of its own. */
function Cell({ shape, id, label, value, options, disabled, onChange }) {
  if (shape.kind === 'fixed') {
    return (
      <span className="text-[13px] text-ink-paper">
        {shape.nameOf ? shape.nameOf(value) : value}
      </span>
    )
  }
  if (shape.kind === 'tick') {
    return (
      <label className={`${optionRow(disabled)} -ml-2`}>
        <input
          type="checkbox"
          className={OPTION_INPUT}
          checked={Boolean(value)}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
        />
        <span>{shape.heading}</span>
      </label>
    )
  }
  if (shape.kind === 'choice') {
    return (
      <select
        id={id}
        className={`${SELECT} ${CONTROL_H} w-full`}
        value={value ?? ''}
        disabled={disabled}
        aria-label={label}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">Pick one</option>
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      id={id}
      type={shape.kind === 'time' ? 'time' : 'text'}
      className={FIELD}
      value={value ?? ''}
      disabled={disabled}
      placeholder={shape.placeholder}
      aria-label={label}
      onChange={event => onChange(event.target.value)}
    />
  )
}

/**
 * Several answers of the same shape: a service and its price, a network and its
 * link, a day and the hours kept on it.
 *
 * The headings are written once above the list rather than once per row,
 * because three rows each labelling their own three cells is nine labels for
 * three questions. Every cell still names itself to a screen reader, which
 * reads the rows one at a time and has no headings to look up to.
 *
 * A list holding its own days is the hours and nothing else: seven rows,
 * every one of them already there, none added and none taken away. A week
 * missing a day is not an answer anybody meant to give, and correcting two
 * rows is less work than filling in fourteen fields.
 */
function ListField({ field, value, onChange, disabled }) {
  const rows = Array.isArray(value) ? value : []
  const keys = field.columns || []
  const fixed = Array.isArray(field.days)
  const blank = () => Object.fromEntries(keys.map(key => [key, '']))

  const write = (at, key, held) =>
    onChange(rows.map((row, index) => (index === at ? { ...row, [key]: held } : row)))

  return (
    <div className={`mt-1.5 ${WIDE}`} aria-describedby={describedBy(field)}>
      {rows.length ? (
        <>
          {/* The headings stand over the rows only where there is room to lay
              them out as columns. Wrapped onto two lines on a phone, a row is
              read as a stack of controls and a heading strip above it is a
              legend for a shape that is no longer there. */}
          <div className="mb-1 hidden flex-wrap items-center gap-2 sm:flex">
            {keys.map(key => (
              <span key={key} className={`${LABEL} ${column(key).width}`}>
                {column(key).heading}
              </span>
            ))}
            {fixed ? null : <span className="w-[4.5rem]" />}
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((row, at) => (
              <li key={fixed ? row[keys[0]] : at} className="flex flex-wrap items-center gap-2">
                {keys.map(key => {
                  const shape = column(key)
                  return (
                    <div key={key} className={shape.width}>
                      <Cell
                        shape={shape}
                        id={`${idOf(field)}-${at}-${key}`}
                        label={`${shape.heading}, row ${at + 1}`}
                        value={row[key]}
                        options={shape.from ? field[shape.from] || [] : []}
                        disabled={disabled || (shape.off ? Boolean(row[shape.off]) : false)}
                        onChange={held => write(at, key, held)}
                      />
                    </div>
                  )
                })}
                {fixed ? null : (
                  <button
                    type="button"
                    className="console-ask-remove w-[4.5rem]"
                    disabled={disabled}
                    onClick={() => onChange(rows.filter((_, index) => index !== at))}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="console-ask-note">Nothing added yet.</p>
      )}
      {fixed ? null : (
        <button
          type="button"
          className={`${QUIET} mt-2`}
          disabled={disabled}
          onClick={() => onChange([...rows, blank()])}
        >
          Add a Row
        </button>
      )}
    </div>
  )
}

/** Which control draws which kind. */
const CONTROLS = {
  text: WrittenOrLine,
  longtext: WrittenField,
  choice: ChoiceField,
  multichoice: MultiField,
  chips: ChipsField,
  files: FilesField,
  address: AddressField,
  list: ListField,
  phone: props => <LineField {...props} type="tel" mode="tel" />,
  email: props => <LineField {...props} type="email" mode="email" />,
  url: props => <LineField {...props} type="url" mode="url" />,
}

/**
 * A one-line answer, or the writing help where the field asks for it.
 *
 * One line of the nine is written rather than stated - the line that goes
 * under the business name on every page - and it is the one sentence on the
 * brief a client is most likely to leave as a shrug. It gets the same help the
 * paragraphs get.
 */
function WrittenOrLine(props) {
  if (props.field.assist && props.assist) return <WrittenField {...props} rows={2} />
  return <LineField {...props} />
}

/**
 * The question, the sentence under it, and the control that answers it.
 *
 * A kind nobody has written a control for draws a plain line rather than
 * nothing at all. A field that vanished over a typo in the catalogue is a
 * question the client is never asked and nobody finds out about until the
 * build is short an answer; a line in the wrong shape is at least something
 * they can type into and a fault anybody looking at the screen can see.
 */
export default function OnboardingFields({ field, value, onChange, disabled, assist }) {
  const Control = CONTROLS[field.kind] || LineField
  // A heading over several controls at once is a span rather than a label: a
  // label pointing at a group has nothing to focus, and a browser handed one
  // puts the caret somewhere the reader did not press. The group names itself
  // by this instead. A choice past the length a list is read at is one chooser
  // with an id of its own, so it takes a real label like every other field.
  const chooser = field.kind === 'choice' && (field.options || []).length > CHOICE_ROWS
  const grouped = !chooser && ['choice', 'multichoice', 'address', 'list'].includes(field.kind)

  return (
    <div className="flex flex-col">
      {grouped ? (
        <span id={`${idOf(field)}-label`} className={LABEL}>
          {field.label}
        </span>
      ) : (
        <label htmlFor={idOf(field)} className={LABEL}>
          {field.label}
        </label>
      )}
      {field.help ? (
        <p id={`${idOf(field)}-help`} className={HELP}>
          {field.help}
        </p>
      ) : null}
      <Control
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        assist={assist}
      />
    </div>
  )
}
