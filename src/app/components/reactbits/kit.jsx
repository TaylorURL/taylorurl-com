/**
 * The accent phrase inside a headline.
 *
 * It sets colour and nothing else, so weight, size and inline flow stay the
 * headline's. The colour is `--accent-loud`, which every ground names for
 * itself — the low step on paper, the bright step on a dark slab — so a phrase
 * reads the same way wherever it lands and neither the call site nor the theme
 * setting has to choose. Both steps clear 4.5:1 against their own ground.
 */
export function AccentGradient({ children, className = '' }) {
  return (
    <span className={className} style={{ color: 'var(--accent-loud)' }}>
      {children}
    </span>
  )
}
