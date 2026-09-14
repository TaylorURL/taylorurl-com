/**
 * The four questions about how a site should look, and the options each one
 * offers.
 *
 * Each question earns its place by changing the first draft: the feeling sets
 * the direction, the brand answer decides whether a palette is used or made,
 * the photography answer decides whether the layout leans on pictures, and the
 * voice answer sets the register every line on the site is written in.
 *
 * They live here rather than in the step that draws them because a brief row
 * written before the client reached the console holds the display name rather
 * than the id, and `onboarding.js` resolves one back to the other against this
 * list. An option renamed here renames both sides of that join at once.
 */

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
