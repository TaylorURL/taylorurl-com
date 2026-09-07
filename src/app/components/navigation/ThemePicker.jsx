import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@hooks/theme/useTheme'

/**
 * The light and dark control, as three states rather than a switch.
 *
 * A two-state toggle cannot say "follow the machine", and a reader whose laptop
 * turns dark at sunset wants that word available. Light and dark are what a
 * reader picks; system is what they pick when they would rather not.
 *
 * The setting lives in the browser rather than on an account, so it works for
 * a visitor who has never signed in and stays with the device rather than
 * following a person between them. Signing in changes nothing here.
 *
 * One control, drawn once: the footer bar and the console's appearance panel
 * both render this, which is why `variant` exists. It changes the frame the
 * three states sit in and nothing about the states themselves.
 */
const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

const FRAME = {
  bar: 'inline-flex items-center gap-0.5 rounded-[var(--r-control)] p-0.5',
  panel: 'flex w-full max-w-[22rem] items-center gap-1 rounded-[var(--r-card)] p-1',
}

// 44px on both, because a thumb is the same size in a footer bar as it is in a
// settings panel and the bar's own height is set by whatever sits in it.
const OPTION = {
  bar: 'min-h-[44px] min-w-[44px] justify-center px-2.5 py-1',
  panel: 'min-h-[44px] flex-1 justify-center px-3 py-2',
}

// The bar has room for icons alone below the small breakpoint; the panel has a
// column of its own and carries the words at every width.
const LABEL = {
  bar: 'hidden sm:inline',
  panel: 'inline',
}

/**
 * @param {object} props
 * @param {'bar' | 'panel'} [props.variant] - Which frame the three states sit
 *   in: a compact row for a footer bar, or a full-width segment for a panel.
 */
export default function ThemePicker({ variant = 'bar' }) {
  const { choice, setChoice } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`border-hair border ${FRAME[variant]}`}
    >
      {OPTIONS.map(option => {
        const { value, label } = option
        const Icon = option.Icon
        const picked = value === choice
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={picked}
            title={label}
            onClick={() => setChoice(value)}
            className={`inline-flex items-center gap-1.5 rounded-[var(--r-tiny)] text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent)] ${
              OPTION[variant]
            } ${
              picked
                ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                : 'text-ink-mute hover:text-ink'
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span className={LABEL[variant]}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
