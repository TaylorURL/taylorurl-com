/**
 * The grounds a ruled section sits on, as the class each role takes on each of
 * them. The configurator alternates between them one step to the next, and the
 * service pages do the same one section to the next.
 *
 * A section names its ground and reads its shell, blueprint rule, ink,
 * hairlines and card surface from here, so the treatments are one decision
 * rather than a set of literals repeated down every section.
 *
 * Four names, and what separates each pair is the setting:
 *
 *   paper  the ground the setting chose — light under light, dark under dark
 *   sheet  a light sheet, under either setting: the same paper roles pinned
 *          against the setting rather than moving with it, which is what a
 *          preview of somebody's website or a card that has to stay white
 *          stands on
 *   dark   the deep slab, one step under the field, and only under the dark
 *          setting
 *   band   the contrasting band, which now stands down under both settings
 *
 * Every ground the stylesheet defines is named here, and each word means one
 * thing: a section that wants the pinned sheet asks for `sheet` rather than
 * stamping the attribute beside a `paper` that means the opposite.
 *
 * `attrs` carries the data-ground the CSS hangs the palette on, so a section
 * spreads it beside the classes and the two can never disagree. The light
 * setting has no slabs in it at all: a reader who asked for light gets a light
 * page, and the contrast a slab was carrying is drawn by the objects set into
 * the field instead. Under the dark setting the slab is one step deeper than
 * the field rather than a reversal of it, so `dark` keeps its palette there
 * and the bands stand down as they always did.
 *
 * A ground that stands down leaves its classes dressed all the same. Every
 * role below has a paper spelling at the document, so `bg-bg`, `text-ink` and
 * the hairlines resolve to the field's own values and the section reads as
 * part of the page.
 *
 * `shell`, `mesh` and `cell` build the ruled meshes the sections are laid out
 * on. Each cell draws its own top and left rule and the mesh is pulled a pixel
 * up and left inside a clipping shell, so the outer rules land on the shell's
 * own border and only the internal ones show.
 *
 * Because a cell draws its own rules, a count that does not divide by the
 * column count draws the shortfall as empty boxes at the end of the last row.
 * `@constants/mesh` holds the columns and spans that close it, and
 * `@components/Mesh` is the mesh itself; a section that lays items out on one
 * goes through those rather than pairing these classes with a column count of
 * its own.
 */
const DARK_CLASSES = {
  section: 'border-hair bg-bg text-ink',
  rule: 'border-hair',
  ruleStrong: 'border-hair-strong',
  shell: 'edge overflow-hidden bg-bg',
  mesh: '-ml-px -mt-px grid',
  cell: 'border-hair border-l border-t',
  surface: 'bg-bg',
  title: 'text-ink',
  body: 'text-ink-soft',
  meta: 'text-ink-faint',
  wash: 'hover:bg-[color:var(--wash-ink)]',
}

const PAPER_CLASSES = {
  section: 'border-hair-paper bg-paper',
  rule: 'border-hair-paper',
  ruleStrong: 'border-hair-paper-strong',
  shell: 'edge overflow-hidden bg-paper',
  mesh: '-ml-px -mt-px grid',
  cell: 'border-hair-paper border-l border-t',
  surface: 'bg-paper',
  title: 'text-ink-paper',
  body: 'text-paper-soft',
  meta: 'text-paper-faint',
  wash: 'hover:bg-[color:var(--wash-paper)]',
}

export const GROUNDS = {
  paper: {
    attrs: {},
    ...PAPER_CLASSES,
  },
  sheet: {
    attrs: { 'data-ground': 'paper' },
    ...PAPER_CLASSES,
  },
  dark: {
    attrs: { 'data-ground': 'dark' },
    ...DARK_CLASSES,
  },
  band: {
    attrs: { 'data-ground': 'band' },
    ...DARK_CLASSES,
  },
}
