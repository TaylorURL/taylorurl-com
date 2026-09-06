/**
 * A palette colour, carried in a custom property and still able to take an
 * opacity modifier.
 *
 * Tailwind builds `bg-accent/60` by substituting an alpha into the colour it
 * was given. A colour held in a custom property has nothing to substitute into,
 * so the utility is not generated at all - the class ships in the markup, the
 * rule does not exist, and the element ends up with no background rather than a
 * translucent one, which is silent in both directions.
 *
 * color-mix takes the alpha at paint time instead, which is the one form that
 * works on a value the stylesheet cannot see.
 */
function tinted(property) {
  return ({ opacityValue }) => {
    // A utility written without a modifier is still handed an opacity - the
    // `--tw-*-opacity` variable the palette normally substitutes into. There is
    // nothing to substitute it into here, and mixing against a value that is
    // not a number yields a colour the browser drops, so anything that is not
    // an alpha is the colour at full strength.
    const alpha = Number(opacityValue)
    if (!Number.isFinite(alpha)) return `var(${property})`
    return `color-mix(in srgb, var(${property}) ${alpha * 100}%, transparent)`
  }
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: tinted('--accent'),
          hi: tinted('--accent-hi'),
          lo: tinted('--accent-lo'),
        },
        ink: {
          DEFAULT: tinted('--ink'),
          soft: tinted('--ink-soft'),
          mute: tinted('--ink-mute'),
          faint: tinted('--ink-faint'),
          paper: tinted('--paper-ink'),
        },
        paper: {
          DEFAULT: tinted('--paper'),
          soft: tinted('--paper-ink-soft'),
        },
        bg: tinted('--bg'),
        // The dim behind a layer. It is its own colour rather than the page
        // ground at an alpha, because a dim is the absence of the page: it
        // stays black while the ground under it moves between the settings.
        scrim: tinted('--scrim-ink'),
      },
      // The stand-in sits directly behind each web font, before the generic
      // families: it is metric-matched to Geist in src/index.css, so the lines
      // it draws while Geist loads are the lines Geist will draw.
      fontFamily: {
        sans: ['Geist', '"Geist Fallback"', 'system-ui', 'sans-serif'],
        display: ['Geist', '"Geist Fallback"', 'system-ui', 'sans-serif'],
        mono: [
          '"Geist Mono"',
          '"Geist Mono Fallback"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      // The curves are the stylesheet's own, named here so the utility and the
      // custom property cannot come apart: a class and a token holding two
      // spellings of one curve is two curves the moment either is tuned.
      transitionTimingFunction: {
        'out-soft': 'var(--ease-out-soft)',
        'in-out-soft': 'var(--ease-in-out-soft)',
      },
      animation: {
        // Content arriving after a read lands on the same curve and the same
        // 0.25s the site changes pages on, so a row appearing in a table and a
        // page replacing another are one piece of motion rather than two.
        'fade-in-up': 'fadeInUp 0.25s var(--ease-out-soft) forwards',
        marquee: 'marquee 28s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}
