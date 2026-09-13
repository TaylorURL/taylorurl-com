import SendButton from './SendButton'

/**
 * The button an enquiry form sends on, with what the sender can expect beside
 * it.
 *
 * @param {{ sending: boolean, children: import('react').ReactNode }} props - `children`
 *   is the button's label.
 */
export default function EnquirySend({ sending, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <SendButton sending={sending}>{children}</SendButton>
      <p className="section-label-sm text-paper-faint">
        Free, and usually answered within the hour
      </p>
    </div>
  )
}
