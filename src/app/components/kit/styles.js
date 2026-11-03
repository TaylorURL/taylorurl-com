/*
 * The kit's class strings, apart from its components so the component file
 * exports nothing but components (which is what lets the dev server swap it in
 * place on an edit). Pages that need a size without a whole piece - a heading
 * inside a card, a line of small print - take it from here.
 *
 * The look is "Signal", from the Figma file "TaylorURL — Simpler Redesign",
 * page "Redesign — Signal": night mastheads over a blueprint grid, paper pages
 * to read on, one signal blue, Geist set very large and tight for what a page
 * is, and Geist Mono in capitals for every label, number and address.
 */

export const TYPE = {
  /* The home page's headline, and the foot-of-page ask. */
  hero: 'text-[clamp(52px,9.2vw,132px)] font-semibold leading-[0.94] tracking-[-0.055em]',
  /* Every other page's headline. */
  display: 'text-[clamp(44px,6.4vw,88px)] font-semibold leading-[0.98] tracking-[-0.045em]',
  /* A section's heading on paper. */
  h2: 'text-[clamp(30px,3.3vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink',
  /* A card's or a step's heading. */
  h3: 'text-[22px] font-semibold leading-[1.25] tracking-[-0.02em] text-ink sm:text-[24px]',
  lead: 'text-[18px] leading-[1.55] sm:text-[21px] sm:leading-[1.5]',
  body: 'text-[17px] leading-[1.6] text-ink-soft',
  small: 'text-[15px] leading-[1.5] text-ink-mute',
  /* The mono label: kickers, section numbers, readout names, button words. */
  mono: 'font-mono text-[12px] font-medium uppercase leading-[1.4] tracking-[0.08em] sm:text-[13px]',
  /* A figure in a readout. */
  figure: 'font-mono text-[40px] font-medium leading-none tracking-[-0.04em] sm:text-[48px]',
}

const BUTTON =
  'inline-flex min-h-[52px] items-center justify-center gap-3 px-6 font-mono text-[13px] font-medium uppercase leading-none tracking-[0.07em] transition-colors duration-150 sm:text-[14px]'

export const BUTTONS = {
  /* The one thing to press, on any ground. */
  blue: `${BUTTON} bg-[var(--signal)] text-white hover:bg-[var(--signal-hi)]`,
  /* The pair's quieter half on night. */
  night: `${BUTTON} border border-[var(--night-line)] text-[color:var(--light)] hover:border-[color:var(--light-soft)]`,
  /* The pair's quieter half on paper. */
  paper: `${BUTTON} border border-[var(--line)] text-ink hover:border-ink`,
  /* On the signal blue band: white key, then an outline. */
  white: `${BUTTON} bg-white text-[color:var(--night)] hover:bg-[var(--light)]`,
  ghost: `${BUTTON} border border-white/45 text-white hover:border-white`,
}

/**
 * Body copy for reading: articles, case studies, the legal pages. A narrow
 * column on paper, generous line height, headings that step down from the
 * page title, mono for code and figures.
 */
export const PROSE =
  'text-[18px] leading-[1.7] text-ink-soft [&_a]:text-[color:var(--signal)] [&_a]:underline [&_a]:underline-offset-[3px] [&_h2]:mt-14 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.025em] [&_h2]:text-ink [&_h3]:mt-9 [&_h3]:text-[21px] [&_h3]:font-semibold [&_h3]:leading-[1.35] [&_h3]:tracking-[-0.015em] [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-5 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-5 [&_ul]:list-[square] [&_ul]:pl-6 [&_li::marker]:text-[color:var(--signal)]'
