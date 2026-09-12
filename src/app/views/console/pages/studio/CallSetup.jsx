import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import {
  CALL_DENSITIES,
  CALL_TAKES,
  LIST_COLUMNS,
  SAVED_VIEW_MAX,
  SAVED_VIEW_NAME_MAX,
  filterChips,
  sameNarrowing,
} from '@lib/outreach/prospects/callPrefs.js'
import { GOAL_CEILING, GOAL_FLOOR, SHIFT_GOALS } from '@lib/outreach/prospects/callShift.js'
import { BUTTON, CHIP, FIELD, MONO_LABEL, QUIET } from '../../lib/tokens'

/**
 * One of the three figures a shift is worked to.
 *
 * The only control on this panel that is typed rather than pressed, and typing
 * is why it holds its own draft. Every other control here writes on the change
 * and the panel redraws from what came back, which is right for a checkbox and
 * wrong for a number: clearing forty to type sixty passes through an empty
 * field, an empty field is not a figure, and a figure that is not a figure is
 * the studio's own - so the field would snap to forty under the cursor.
 *
 * So the draft is what is on screen while the field is being typed in, and the
 * figure is written when the field is left. A number outside the two bounds is
 * pulled back to them on the way out rather than refused, because a caller who
 * typed 1000 meant a big number and not a refusal.
 */
function GoalField({ one, had, onSet }) {
  const [draft, setDraft] = useState(null)
  const leave = () => {
    setDraft(null)
    const figure = Number.parseInt(String(draft ?? ''), 10)
    if (!Number.isFinite(figure)) return
    const held = Math.min(GOAL_CEILING, Math.max(GOAL_FLOOR, figure))
    if (held !== had) onSet(held)
  }
  return (
    <label className="grid gap-1.5">
      <span className={`${MONO_LABEL} text-paper-faint`}>{one.label}</span>
      <input
        type="number"
        inputMode="numeric"
        className={FIELD}
        min={GOAL_FLOOR}
        max={GOAL_CEILING}
        value={draft ?? had ?? ''}
        onChange={event => setDraft(event.target.value)}
        onBlur={leave}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}

/**
 * The list set up the way one person wants to read it, kept on their account.
 *
 * Everything in here is a fact about the reader rather than about the call
 * list, which is why none of it is a default anybody argued over. Somebody who
 * works the list four hours a day wants forty rows on screen and will open a
 * record when they want the reasoning; somebody who rings ten a week wants the
 * scoring on the row and does not care that it costs half the screen. Neither
 * is right, so both are stored, per account, and the page draws whichever this
 * account asked for.
 *
 * The saved narrowings are the same idea one level up. A caller who only ever
 * rings one town types that town into a dropdown every morning until they stop
 * bothering; a caller who works the never-called pile at 55 and up sets three
 * controls to do it. Keeping either under a name is one press, and reading it
 * back is one press.
 *
 * Nothing here is applied and then saved. Each control writes as it is used,
 * because a setup panel with a Save button is a setup panel somebody changes
 * three things in and closes.
 */
export default function CallSetup({
  prefs,
  people = [],
  filters,
  sort,
  onChange,
  onApply,
  onDrop,
  onKeep,
}) {
  const [naming, setNaming] = useState('')
  const chosen = new Set(prefs.columns)
  const narrowings = filterChips(filters, people)
  const kept = prefs.views
  const already = kept.find(one => sameNarrowing(one, { filters, sort })) ?? null
  const full = kept.length >= SAVED_VIEW_MAX

  const toggle = id => {
    const next = prefs.columns.filter(one => one !== id)
    onChange({ columns: chosen.has(id) ? next : [...next, id] })
  }

  const keep = event => {
    event.preventDefault()
    const name = naming.trim()
    if (!name || full) return
    onKeep(name)
    setNaming('')
  }

  return (
    <div className="grid gap-6 px-5 py-4">
      <section className="grid gap-2">
        <h3 className={`${MONO_LABEL} text-paper-faint`}>Rows</h3>
        <div className="flex flex-wrap gap-2">
          {CALL_DENSITIES.map(one => (
            <button
              key={one.id}
              type="button"
              className={one.id === prefs.density ? BUTTON : QUIET}
              aria-pressed={one.id === prefs.density}
              onClick={() => onChange({ density: one.id })}
            >
              {one.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-paper-soft">
          {CALL_DENSITIES.find(one => one.id === prefs.density)?.note}
        </p>
      </section>

      <section className="grid gap-2">
        <h3 className={`${MONO_LABEL} text-paper-faint`}>Columns</h3>
        <ul className="grid gap-1">
          {LIST_COLUMNS.map(column => (
            <li key={column.id}>
              {/* A column the list cannot be worked without is drawn as
                  settled rather than as a control that refuses to move. */}
              {column.fixed ? (
                <span
                  className={`${MONO_LABEL} text-paper-faint flex min-h-[32px] items-center gap-2 px-1`}
                >
                  <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {column.label}
                  <span className="ml-auto">Always</span>
                </span>
              ) : (
                <label
                  className={`${MONO_LABEL} flex min-h-[32px] cursor-pointer items-center gap-2 rounded-[var(--console-radius-sm)] px-1 text-ink-paper transition-colors duration-150 ease-out-soft hover:text-accent`}
                >
                  <input
                    type="checkbox"
                    className="accent-[color:var(--accent)]"
                    checked={chosen.has(column.id)}
                    onChange={() => toggle(column.id)}
                  />
                  {column.label}
                </label>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-paper-soft">
          A narrow screen draws only the columns it cannot be worked without, whatever is ticked
          here.
        </p>
      </section>

      <section className="grid gap-2">
        <h3 className={`${MONO_LABEL} text-paper-faint`}>Rows A Page</h3>
        <div className="flex flex-wrap gap-2">
          {CALL_TAKES.map(size => (
            <button
              key={size}
              type="button"
              className={size === prefs.take ? BUTTON : QUIET}
              aria-pressed={size === prefs.take}
              onClick={() => onChange({ take: size })}
            >
              {size}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-paper-soft">
          How many businesses one page of the list holds before the pager takes over.
        </p>
      </section>

      {/* The three figures a shift is read against, wherever it is read. They
          sit here rather than in a dialog of their own because a goal is a fact
          about the person working the list, which is what every other control
          on this panel is, and because somebody setting up how they read the
          list is the same person deciding what a day of it looks like. */}
      <section className="grid gap-2">
        <h3 className={`${MONO_LABEL} text-paper-faint`}>Your Shift</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {SHIFT_GOALS.map(one => (
            <GoalField
              key={one.id}
              one={one}
              had={prefs.goals?.[one.id]}
              onSet={figure => onChange({ goals: { ...prefs.goals, [one.id]: figure } })}
            />
          ))}
        </div>
        <p className="text-[13px] text-paper-soft">
          What a day on the phone comes to. The Call Center counts your calls against the first of
          them as you go, and the Management Center draws all three and says what time you finish at
          the rate the day has gone.
        </p>
      </section>

      <section className="grid gap-2">
        <h3 className={`${MONO_LABEL} text-paper-faint`}>Saved Narrowings</h3>
        {kept.length ? (
          <ul className="grid gap-1">
            {kept.map(one => (
              <li key={one.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${MONO_LABEL} min-h-[32px] flex-1 truncate rounded-[var(--console-radius-sm)] px-1 text-left transition-colors duration-150 ease-out-soft ${
                    already?.id === one.id ? 'text-accent' : 'text-ink-paper hover:text-accent'
                  }`}
                  onClick={() => onApply(one)}
                >
                  {one.name}
                </button>
                <button
                  type="button"
                  className={`${QUIET} px-2`}
                  aria-label={`Forget ${one.name}`}
                  onClick={() => onDrop(one.id)}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-paper-soft">
            Nothing kept yet. Narrow the list the way you work it, then name it here.
          </p>
        )}

        <form onSubmit={keep} className="grid gap-2">
          <span className="flex flex-wrap gap-1.5">
            {narrowings.length ? (
              narrowings.map(chip => (
                <span key={chip.key} className={CHIP}>
                  {chip.label}
                </span>
              ))
            ) : (
              <span className={`${MONO_LABEL} text-paper-faint`}>
                Nothing is narrowed, so there is nothing to keep.
              </span>
            )}
          </span>
          <input
            type="text"
            className={FIELD}
            value={naming}
            maxLength={SAVED_VIEW_NAME_MAX}
            placeholder="Name this narrowing"
            aria-label="Name This Narrowing"
            onChange={event => setNaming(event.target.value)}
          />
          <button
            type="submit"
            className={BUTTON}
            disabled={!naming.trim() || !narrowings.length || full}
          >
            {full ? `That is all ${SAVED_VIEW_MAX} of them` : 'Keep This Narrowing'}
          </button>
        </form>
      </section>

      <p className={`${MONO_LABEL} text-paper-faint`}>
        All of it is kept on your account, so it is the same on whichever machine you sign in from.
      </p>
    </div>
  )
}
