/*
 * The kit's class strings, apart from its components so the component file
 * exports nothing but components (which is what lets the dev server swap it in
 * place on an edit). Pages that need a size without a whole piece - a heading
 * inside a card, a line of small print - take it from here.
 *
 * The look is "Refined", from the Figma file "TaylorURL — Simpler Redesign",
 * page "Directions — pick one", frame A: the site's own dark ground, made
 * calmer. Geist at a medium weight and modest sizes, warm white type, cards
 * set apart by a lighter fill rather than an outline, pill buttons, one blue.
 */

export const TYPE = {
  /* The home page's headline. */
  hero: 'text-[42px] font-medium leading-[1.06] tracking-[-0.035em] text-ink sm:text-[56px] lg:text-[68px]',
  /* Every other page's headline. */
  display:
    'text-[38px] font-medium leading-[1.08] tracking-[-0.032em] text-ink sm:text-[48px] lg:text-[54px]',
  /* A section's heading. */
  h2: 'text-[28px] font-medium leading-[1.15] tracking-[-0.028em] text-ink sm:text-[32px]',
  /* A card's or a step's heading. */
  h3: 'text-[18px] font-medium leading-[1.35] tracking-[-0.012em] text-ink sm:text-[19px]',
  lead: 'text-[17px] leading-[1.6] text-ink-soft sm:text-[19px]',
  body: 'text-[16px] leading-[1.65] text-ink-soft',
  small: 'text-[14px] leading-[1.5] text-ink-mute',
  /* A short label over a group or a figure. */
  label: 'text-[13px] font-medium leading-[1.4] text-ink-mute',
  /* A figure in a stat panel. */
  figure: 'text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink',
}

const BUTTON =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-[22px] text-[15px] font-medium leading-none transition-colors duration-150'

export const BUTTONS = {
  /* The one thing to press. */
  primary: `${BUTTON} bg-[var(--blue)] text-white hover:bg-[var(--blue-hi)]`,
  /* The pair's quieter half: a pale filled pill. */
  secondary: `${BUTTON} bg-white/[0.08] text-ink hover:bg-white/[0.13]`,
}

/**
 * A card: one step up from the ground, soft corners, and no outline. The
 * lighter fill is what sets it apart; a white line round every box was the
 * thing that made the page look busy.
 */
export const CARD = 'rounded-[16px] bg-[var(--card)]'

/**
 * Body copy for reading: articles, case studies, the legal pages. A narrow
 * column, generous line height, headings that step down from the page title.
 */
export const PROSE =
  'text-[17px] leading-[1.75] text-ink-soft [&_a]:text-[color:var(--link)] [&_a]:underline [&_a]:underline-offset-[3px] [&_h2]:mt-12 [&_h2]:text-[24px] [&_h2]:font-medium [&_h2]:leading-[1.3] [&_h2]:tracking-[-0.02em] [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:text-[19px] [&_h3]:font-medium [&_h3]:leading-[1.4] [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li::marker]:text-ink-mute'
