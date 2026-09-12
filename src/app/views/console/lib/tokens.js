/**
 * The class strings the console's furniture and its sections share.
 *
 * They live apart from the components that use them so a section can import a
 * label style without pulling in a component, and so the shared UI file exports
 * components only.
 */

// The small label a section puts above a figure or beside a control.
//
// Sentence case at reading size rather than tracked capitals. A dashboard sets
// dozens of these on one screen, and capitals at 10px are decoded before they
// are read: a reader scanning for one figure pays that cost on every label
// they pass. The mono face stays where a fixed advance is doing work, which is
// figures and keys rather than words.
export const MONO_LABEL = 'text-[12px] font-medium'
// Column labels never wrap. A wrapped one is hard to read at 10px, and its
// height depends on how wide the data underneath happens to make the column -
// which is how a table head ends up one line while it loads and two once the
// figures arrive.
// Sticking the head is handled in the base layer, which is where the offset
// under the fixed bar and the head's own ground are set.
export const TH = `${MONO_LABEL} text-paper-faint whitespace-nowrap px-5 py-2.5 text-left`
export const CELL = 'px-5 py-3 text-[14px]'

// The same two, for a table that has to fit the column it was given rather
// than scroll inside it.
//
// The card's gutter between every pair of columns is what makes a wide table
// wide: ten columns at that measure spend four hundred pixels on padding
// before a figure is drawn, and the table goes past the page. The gutter is
// kept where it is read as one - at the table's two outside edges, by
// `.console-table` - and the measure between the columns is this.
export const TH_TIGHT = `${MONO_LABEL} text-paper-faint whitespace-nowrap px-3 py-2.5 text-left`
export const CELL_TIGHT = 'px-3 py-3 text-[14px]'

// The same head and cell for a column that sets its content against the far
// edge rather than the reading one.
//
// Written out rather than composed with a `text-right` after `text-left`: two
// utilities of the same specificity are settled by the order the stylesheet
// happens to emit them in, not by the order they are written in the class
// attribute, so one of the two would win everywhere and it would not
// necessarily be this one. The left measure is the half that gives way, because
// the gutter on the far side is the card's own edge and is what the head above
// is aligned to.
export const TH_END = `${MONO_LABEL} text-paper-faint whitespace-nowrap pl-1 pr-3 py-2.5 text-right`
export const CELL_END = 'pl-1 pr-3 py-3 text-[14px] text-right'

// One line a row, for a table somebody is working down rather than reading.
//
// A row that carries a second line under each figure is easier to understand
// and there are half as many of them on the screen. Which of those two a person
// wants is not a fact about the table, so both are here and the section that
// has a reader with a preference lets them keep it.
export const CELL_PACKED = 'px-3 py-1.5 text-[13px]'

// Every chart reserves its box before recharts measures the container, so a
// panel does not grow under the reader when the series arrives. The heights sit
// beside the other measures so a chart and the placeholder standing in for it
// read the same number.
export const CHART_HEIGHT = {
  traffic: 220,
  hour: 140,
  donut: 124,
  spark: 26,
  // A sparkline given a whole card rather than a fifth of a table row. At the
  // row's own height a full-width series flattens into a rule.
  trend: 108,
}

// Row heights, measured from the rows these placeholders stand in for. The
// height is set rather than padded to, because what each row is actually as
// tall as is its own tallest cell, and a placeholder cannot contain those.
//
// Only the first visit reads these: after one, the placeholder is the size of
// the table the reader last saw. They are still worth measuring again whenever
// a row gains a cell, since a figure left behind by its own table leaves the
// first paint short and everything under it moves down as the feed lands - the
// one thing the placeholder exists to prevent.
export const ROW_HEIGHT = {
  sites: '46px',
  pages: '55px',
  plain: '40.5px',
  // First-visit fallbacks for the status board, measured at 1280px: after that
  // its placeholder is the size of the rows the reader last saw. The open-issue
  // table is nearly always empty, so its figure is that one sentence row.
  //
  // The site row is one line on tight cells; the fixed row is two, the site
  // name with the time it was resolved beneath, and averages more because a
  // summary wraps in its column. Each figure is the measured mean over the
  // whole table rather than the height of its shortest row. Taking the shorter
  // one left the placeholder well under the table it stood in for, and
  // everything below moved down as the feed landed.
  // Two lines now rather than one: the identity line and the strip's band
  // under it, measured off the entry itself.
  statusSite: '73px',
  statusIssue: '100px',
  statusFixed: '125px',
  // The call list at its roomy setting: two lines in four of its columns - the
  // business over its trade and town, the trade reading over the counts behind
  // it, the state over when it comes back - a bar under the score, and two to
  // four chips stacked in the reasons column. The mean over the whole table at
  // 1280px rather than the height of its shortest row, which would leave the
  // first paint short and move everything under it down as the feed lands.
  calls: '77.5px',
  // The same table with the second line out of every cell. Only a first visit
  // reads either figure: after one, the placeholder is the size of the rows
  // this reader last saw, at the density they last read them at.
  callsTight: '38px',
  // The Server section's routines: a routine's name over the sentence saying
  // what it does, a badge over its cadence, and a relative time over the clock
  // time in each of the last two columns - so every row is two lines and some
  // are three where a description wraps. The mean over the whole table,
  // measured in the work region a 1280px console gives it rather than at the
  // viewport's own width, since the rail takes fifteen rems off it. Only a
  // first visit reads it: after one, the placeholder is the size of the rows
  // this reader last saw.
  serverRoutine: '70px',
}

// The console's controls, held once. Nothing about a select or a button
// changes because of which section it sits in, so the sections import these
// rather than spelling them out.
//
// One height covers all of them, fields included: a row of controls at two
// heights reads as one of them being in a different state. Forty-four, because
// the console is opened on a phone as often as the marketing pages are and a
// control a thumb cannot land on is a control that is not there.
export const CONTROL_H = 'min-h-[44px]'

export const SELECT = `${MONO_LABEL} ${CONTROL_H} border-hair-paper-strong cursor-pointer appearance-none rounded-[var(--console-radius-sm)] border bg-[color:var(--paper-field)] px-2.5 py-1 text-ink-paper transition-colors duration-150 ease-out-soft hover:border-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]`

// The same control, saying that it is the reason a row is missing.
//
// A row of six dropdowns is six values to read before a reader knows why the
// business they expected is not on screen, and every one of them looks
// identical whether it is narrowing anything or not. The one that is holding
// something back says so: it carries the accent its own chip carries, so a
// glance across the row finds it without reading a word.
export const SELECT_ON = `${SELECT} border-[color:var(--accent)] text-accent`

// One narrowing, with the way to take it off.
//
// Read as a group under the controls, so what the list is actually narrowed to
// is one line rather than six values scattered along a row of boxes.
export const CHIP = `${MONO_LABEL} border-hair-paper text-paper-soft inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 transition-colors duration-150 ease-out-soft`

export const CHIP_BUTTON = `${CHIP} cursor-pointer hover:border-[color:var(--accent)] hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]`

// A chip that is on: the saved view being read right now.
export const CHIP_ON = `${CHIP_BUTTON} border-[color:var(--accent)] bg-[color:var(--wash-accent)] text-accent`

// Hover deepens the ground rather than fading it, which is the one hover
// vocabulary the rest of the console uses.
export const BUTTON = `${MONO_LABEL} ${CONTROL_H} inline-flex cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-[var(--console-radius-sm)] bg-[color:var(--accent-fill)] px-3.5 text-[color:var(--on-accent)] transition-[background-color,transform] duration-150 ease-out-soft hover:bg-[color:var(--accent-fill-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50`

export const QUIET = `${MONO_LABEL} ${CONTROL_H} text-paper-faint border-hair-paper inline-flex cursor-pointer touch-manipulation items-center gap-1.5 rounded-[var(--console-radius-sm)] border px-2.5 transition-[color,border-color,transform] duration-150 ease-out-soft hover:border-[color:var(--accent)] hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50`

// The quiet control on a table row drawn at the tight setting, where a
// forty-four pixel button is taller than the row it sits in.
//
// Only the drawing shrinks. The reach stays what a thumb needs and is carried
// out over the row's own padding by a pseudo-element, which is the same trick
// the account screens use on their three inline controls and for the same
// reason: nothing on screen moves, and every one of them can still be hit.
export const QUIET_ROW = `${MONO_LABEL} text-paper-faint border-hair-paper relative inline-flex min-h-[26px] cursor-pointer touch-manipulation items-center gap-1.5 rounded-[var(--console-radius-sm)] border px-1.5 transition-[color,border-color] duration-150 ease-out-soft before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] hover:border-[color:var(--accent)] hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50`

// A field carries a focus border as well as the shared outline, since where
// the caret is is the one thing a form most needs to say.
export const FIELD = `${CONTROL_H} border-hair-paper-strong w-full rounded-[var(--console-radius-sm)] border bg-[color:var(--paper-field)] px-2.5 py-1.5 text-[13px] text-ink-paper transition-colors duration-150 ease-out-soft placeholder:text-paper-faint focus:border-[color:var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]`
