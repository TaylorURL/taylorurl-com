import SendButton from './SendButton'

/**
 * The button an enquiry form sends on, the width of the form, the way the
 * Start page's is.
 *
 * @param {{ sending: boolean, children: import('react').ReactNode }} props - `children`
 *   is the button's label.
 */
export default function EnquirySend({ sending, children }) {
  return (
    <div className="[&>button]:w-full">
      <SendButton sending={sending}>{children}</SendButton>
    </div>
  )
}
