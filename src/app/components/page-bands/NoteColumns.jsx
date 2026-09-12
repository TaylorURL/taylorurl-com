import { m } from 'framer-motion'
import { staggerChild } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'

/**
 * A band's notes set as plain columns: a heading and the paragraph under it,
 * one list item each, two abreast once there is room for the pair.
 *
 * Most band content on this site is laid on a ruled mesh, and this is the case
 * against putting notes on one. A mesh cell is the shell the linked cells use,
 * so a note drawn in one tells a reader it opens a page that does not exist,
 * and the box costs the paragraph its padding on both sides: at the rail's full
 * width that pushed the line past the measure prose is read at. A note is a
 * heading and a paragraph, and that is all this draws.
 *
 * The column gap grows with the rail for the same reason. Held at one value it
 * is either too narrow at the widest, where the two columns close up and read
 * as one block of text, or too wide at the narrowest, where each column is left
 * too thin to set a sentence in. The wide step holds the line under
 * seventy-five characters at the rail's full 1152px, which is the widest the
 * columns ever get.
 *
 * The list is a list, and it says so twice. Removing the bullets is what takes
 * the list role away from a `ul` in Safari, so the four notes would otherwise
 * be read out as four unrelated headings rather than as a set with a count.
 *
 * @param {object} props
 * @param {Array<{ title: string, body: string }>} props.notes - The notes, in
 *   the order they are read.
 * @param {'paper' | 'sheet' | 'dark' | 'band'} [props.ground] - Which ground
 *   the band stands on, which is where the two weights of ink come from.
 */
export default function NoteColumns({ notes, ground = 'paper' }) {
  const tone = GROUNDS[ground]

  return (
    <ul role="list" className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:gap-x-24">
      {notes.map((note, index) => (
        <m.li key={note.title} {...staggerChild(index)}>
          <h3 className={`text-[18px] font-semibold leading-tight tracking-tight ${tone.title}`}>
            {note.title}
          </h3>
          <p className={`mt-5 text-[16px] leading-relaxed ${tone.body}`}>{note.body}</p>
        </m.li>
      ))}
    </ul>
  )
}
