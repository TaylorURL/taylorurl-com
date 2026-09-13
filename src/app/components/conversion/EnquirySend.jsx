import { ArrowUpRight } from 'lucide-react'

/**
 * The button an enquiry form sends on, with what the sender can expect beside
 * it. While the send is out the button says so and stops taking presses.
 *
 * @param {{ sending: boolean, children: import('react').ReactNode }} props - `children`
 *   is the button's label.
 */
export default function EnquirySend({ sending, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <button type="submit" disabled={sending} className="btn btn-primary group">
        {sending ? 'Sending…' : children}
        {!sending && (
          <ArrowUpRight
            className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </button>
      <p className="section-label-sm text-paper-faint">
        Free, and usually answered within the hour
      </p>
    </div>
  )
}
