/**
 * Site-tuned presets over the raw react-bits primitives, so the animated layer
 * speaks the same visual language as the rest of the site — the brand accent
 * (#2f6bff), inherited heading weight, and inline flow.
 */
import GradientText from './GradientText/GradientText'

const ACCENT_STOPS = ['#2f6bff', '#4f86ff', '#9dbcff', '#4f86ff', '#2f6bff']

/**
 * Animated accent phrase for headlines. Drops in where the site previously used
 * `<span className="text-accent">…</span>`, adding a slow gradient sweep through
 * the brand blues while inheriting the heading's weight and line height.
 */
export function AccentGradient({ children, className = '', animationSpeed = 9 }) {
  return (
    <GradientText colors={ACCENT_STOPS} animationSpeed={animationSpeed} className={className}>
      {children}
    </GradientText>
  )
}
