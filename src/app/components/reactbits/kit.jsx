/**
 * Site-tuned presets over the raw react-bits primitives, so the animated layer
 * speaks the same visual language as the rest of the site — the brand accent
 * (#2f6bff), inherited heading weight, and inline flow.
 */
import GradientText from './GradientText/GradientText'

const ACCENT_STOPS = ['#2f6bff', '#4f86ff', '#9dbcff', '#4f86ff', '#2f6bff']

// On paper surfaces the sweep must never pass through the pale #9dbcff stop —
// large headline words drop to ~1.8:1 against the paper at that moment. This
// range keeps every stop at or above 3:1 while preserving the moving light.
const ACCENT_STOPS_PAPER = ['#1a4ed8', '#2f6bff', '#4f86ff', '#2f6bff', '#1a4ed8']

/**
 * Drop-in replacement for `<span className="text-accent">` in headlines — adds a
 * slow gradient sweep while inheriting the heading's weight and line height.
 * Use `on="paper"` for headlines on light sections so the sweep stays legible.
 */
export function AccentGradient({ children, className = '', animationSpeed = 9, on = 'dark' }) {
  return (
    <GradientText
      colors={on === 'paper' ? ACCENT_STOPS_PAPER : ACCENT_STOPS}
      animationSpeed={animationSpeed}
      className={className}
    >
      {children}
    </GradientText>
  )
}
