/**
 * The questions the look step asks, and how the answers read in the inquiry.
 *
 * The options live here rather than in the section that draws them, so the
 * summary the message carries names them in the same words they were read in.
 * Each question earns its place by changing the first draft: the feeling sets
 * the direction, the brand answer decides whether a palette is used or made,
 * the photography answer decides whether the layout leans on pictures, and the
 * voice answer sets the register every line on the site is written in.
 */

/** How many feelings one answer carries, so the set stays a direction. */
export const FEEL_LIMIT = 3

export const FEELINGS = [
  { id: 'clean', name: 'Clean and simple' },
  { id: 'warm', name: 'Warm and friendly' },
  { id: 'bold', name: 'Bold and loud' },
  { id: 'premium', name: 'Premium and understated' },
  { id: 'practical', name: 'Hard-wearing and practical' },
  { id: 'technical', name: 'Serious and technical' },
]

export const BRAND_STATES = [
  { id: 'ready', name: 'Logo and colors ready' },
  { id: 'logo-only', name: 'A logo, no set colors' },
  { id: 'nothing', name: 'Nothing yet' },
]

export const PHOTO_STATES = [
  { id: 'plenty', name: 'Plenty of our own photos' },
  { id: 'some', name: 'A few photos' },
  { id: 'none', name: 'No photos yet' },
]

export const VOICE_STEPS = [
  { id: 'plain', name: 'Plain and friendly' },
  { id: 'between', name: 'Somewhere in between' },
  { id: 'formal', name: 'Formal and professional' },
]

/** A look with nothing answered yet. */
export const EMPTY_LOOK = { feels: [], brand: null, photos: null, voice: null, notes: '' }

const nameOf = (options, id) => options.find(option => option.id === id)?.name

/**
 * The questions on the look step that are still unanswered, in the words a
 * sentence naming them would use.
 *
 * Each of the four changes what the first draft is drawn from, so a step that
 * lets all four go by hands the drawing nothing and the visitor a screen they
 * were better off never opening. That is what makes them required rather than
 * offered, and this is the list the step shows when it will not open the next
 * one.
 *
 * The notes box is not among them, and that is the point of the box: it holds
 * the thing a list of options cannot, and a brief with nothing typed there is
 * a finished brief rather than an unfinished one.
 *
 * @param {{ feels: string[], brand: string | null, photos: string | null,
 *   voice: string | null }} look The answers so far.
 * @returns {string[]} The open questions, in the order they are asked.
 */
export function lookOpen(look) {
  const open = []
  if (!look.feels.length) open.push('how it should feel')
  if (!look.brand) open.push('logo and colors')
  if (!look.photos) open.push('photographs')
  if (!look.voice) open.push('how it reads')
  return open
}

/**
 * The look, as the inquiry summary and the message both write it. A question
 * left alone still takes a row, so the message says which parts of the brief
 * are open rather than leaving them out.
 *
 * @param {{ feels: string[], brand: string | null, photos: string | null,
 *   voice: string | null, notes: string }} look The answers so far.
 * @returns {Array<{ label: string, value: string }>} One row per question.
 */
export function lookSummary(look) {
  const feels = FEELINGS.filter(option => look.feels.includes(option.id)).map(option => option.name)

  return [
    { label: 'How It Should Feel', value: feels.join(', ') || 'Not chosen' },
    { label: 'Logo and Colors', value: nameOf(BRAND_STATES, look.brand) || 'Not chosen' },
    { label: 'Photographs', value: nameOf(PHOTO_STATES, look.photos) || 'Not chosen' },
    { label: 'How It Reads', value: nameOf(VOICE_STEPS, look.voice) || 'Not chosen' },
    { label: 'Sites to Look At', value: look.notes.trim() || 'None given' },
  ]
}
