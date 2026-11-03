/*
 * The kit's class strings, apart from its components so the component file
 * exports nothing but components (which is what lets the dev server swap it in
 * place on an edit). Pages that need a size without a whole piece - a heading
 * inside a card, a line of small print - take it from here.
 */

export const TYPE = {
  display:
    'text-[40px] leading-[1.1] sm:text-[60px] sm:leading-[1.07] font-semibold tracking-[-0.03em] text-ink',
  h1: 'text-[34px] leading-[1.15] sm:text-[48px] sm:leading-[1.12] font-semibold tracking-[-0.025em] text-ink',
  h2: 'text-[26px] leading-[1.2] sm:text-[32px] sm:leading-[1.19] font-semibold tracking-[-0.02em] text-ink',
  h3: 'text-[19px] leading-[1.4] sm:text-[20px] font-semibold tracking-[-0.01em] text-ink',
  lead: 'text-[18px] leading-[1.55] sm:text-[20px] sm:leading-[1.5] text-ink-soft',
  body: 'text-[17px] leading-[1.6] text-ink-soft',
  small: 'text-[15px] leading-[1.45] text-ink-mute',
  label: 'text-[16px] font-medium leading-[1.25] text-ink',
  eyebrow: 'text-[14px] font-medium leading-[1.4] text-accent',
}

const BUTTON =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] px-[22px] text-[16px] font-medium leading-none transition-colors duration-150'

export const BUTTONS = {
  primary: `${BUTTON} bg-[var(--accent-fill)] text-[color:var(--on-accent)] hover:bg-[var(--accent-fill-hi)]`,
  secondary: `${BUTTON} border border-[var(--line)] bg-[var(--paper)] text-ink hover:border-[color:var(--hairline-strong)] hover:bg-[var(--band)]`,
}

/**
 * Body copy for reading: articles, case studies, the legal pages. A narrow
 * column, generous line height, headings that step down from the page title.
 */
export const PROSE =
  'text-[17px] leading-[1.7] text-ink-soft [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-12 [&_h2]:text-[24px] [&_h2]:font-semibold [&_h2]:leading-[1.3] [&_h2]:tracking-[-0.015em] [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:leading-[1.4] [&_h3]:text-ink [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6'
