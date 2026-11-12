/*
 * The kit's class strings, apart from its components so the component file
 * exports nothing but components (which is what lets the dev server swap it in
 * place on an edit). Pages that need a size without a whole piece - a heading
 * inside a card, a line of small print - take it from here.
 *
 * The look follows whatsapp.com almost one for one, in TaylorURL's colours:
 * large headlines set in a regular weight and tight leading, 18px body copy,
 * pill buttons, 32px rounded cards and bands, and a brand underline under every
 * text link. The frames are in the Figma file "TaylorURL — WhatsApp-Style
 * Redesign" (https://www.figma.com/design/g9K8x6H6nU12rqQvVNKOkO).
 */

export const TYPE = {
  /* The home page's headline: whatsapp.com's 80/80 (44/44 on a phone). */
  hero: 'wa-words text-[44px] font-normal leading-[1] tracking-[-0.02em] text-ink sm:text-[64px] lg:text-[80px]',
  /* Every other page's headline, on the same scale. */
  display:
    'wa-words text-[44px] font-normal leading-[1] tracking-[-0.02em] text-ink sm:text-[56px] lg:text-[72px]',
  /* A section's heading: 60/60, 32/32 on a phone. */
  h2: 'wa-words text-[32px] font-normal leading-[1] tracking-[-0.015em] text-ink sm:text-[44px] lg:text-[60px]',
  /* A card's heading: 32/32 on a wide screen, as whatsapp.com's blog cards. */
  h3: 'text-[24px] font-normal leading-[1] tracking-[-0.01em] text-ink lg:text-[32px]',
  /* The centred statement under the home page's first screen: 48/48, 24/24. */
  statement:
    'wa-words text-[24px] font-normal leading-[1] tracking-[-0.015em] text-ink sm:text-[36px] lg:text-[48px]',
  lead: 'text-[16px] leading-[22px] text-ink sm:text-[18px] sm:leading-[25px]',
  body: 'text-[16px] leading-[22px] text-ink-soft sm:text-[18px] sm:leading-[25px]',
  small: 'text-[16px] leading-[22px] text-ink-mute',
  /* A short label over a group or a figure: whatsapp.com's 12px footer heads. */
  label: 'text-[12px] font-normal leading-[1.3] text-ink-mute',
  /* A figure in a stat panel. */
  figure: 'text-[32px] font-normal leading-none tracking-[-0.015em] text-ink sm:text-[48px]',
}

/* whatsapp.com's pill: 16px/500, 16px 28px, radius 50px, a 1px border, and the
   rising-circle fill when pointed at (in src/index.css under "Buttons"). */
const BUTTON = 'wa-btn'

export const BUTTONS = {
  /* The one thing to press: brand blue, filling with ink when pointed at. */
  primary: `${BUTTON} wa-btn-fill`,
  /* The pair's quieter half: an outlined pill. */
  secondary: `${BUTTON} wa-btn-outline`,
}

/**
 * A card: one step up from the ground, whatsapp.com's 25px corners (15px on a
 * phone), no outline.
 */
export const CARD = 'wa-card rounded-[15px] bg-[var(--card)] sm:rounded-[25px]'

/**
 * Body copy for reading: articles, case studies, the legal pages. A narrow
 * column, generous line height, headings that step down from the page title.
 */
export const PROSE =
  'text-[18px] leading-[1.7] text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:decoration-[color:var(--blue)] [&_a]:decoration-2 [&_a]:underline-offset-[5px] [&_h2]:mt-14 [&_h2]:text-[32px] [&_h2]:font-normal [&_h2]:leading-[1.15] [&_h2]:tracking-[-0.025em] [&_h2]:text-ink [&_h3]:mt-9 [&_h3]:text-[22px] [&_h3]:font-normal [&_h3]:leading-[1.3] [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-5 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li::marker]:text-ink-mute'
