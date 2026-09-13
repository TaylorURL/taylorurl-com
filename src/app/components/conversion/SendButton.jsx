import { ArrowUpRight } from 'lucide-react'

/**
 * A form's primary submit button. While its request is out it says so in place
 * of its label, loses its arrow and stops taking presses.
 *
 * @param {object} props
 * @param {boolean} props.sending - Whether the request is out.
 * @param {string} [props.pending] - What the button says while it is.
 * @param {import('react').ReactNode} props.children - The button's label.
 */
export default function SendButton({ sending, pending = 'Sending…', children }) {
  return (
    <button type="submit" disabled={sending} className="btn btn-primary group">
      {sending ? pending : children}
      {!sending && (
        <ArrowUpRight
          className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
