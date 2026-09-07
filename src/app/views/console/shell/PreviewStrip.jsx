/**
 * The band that says whose console this is.
 *
 * It is a row of the layout rather than a badge in the bar or a toast, because
 * the one failure this exists to prevent is an admin acting on a sample build
 * believing it is a client's. The console frame is the height of the window and
 * does not scroll - the work region inside it does - so a band at the top is on
 * screen at every scroll position of every section, on a phone as well as at a
 * desk. A toast would time out, and a badge in the bar would be one more small
 * grey thing on a row that already has five.
 *
 * It carries the only way out. The account panel underneath is a client's panel
 * while the preview is on, which is the whole point of it, so the door has to be
 * somewhere a client's console has no room for.
 *
 * `role="status"` announces it once on arrival rather than interrupting, which
 * is the right weight: it is a standing condition and not an alert.
 */
export default function PreviewStrip({ business, onLeave }) {
  return (
    <div className="console-preview" role="status">
      <span className="console-preview-mark" aria-hidden="true" />
      <p className="console-preview-line">
        You are looking at the console the way a client sees it, on a sample build for {business}.
        Nothing you do here is saved, and no real project can be reached from it.
      </p>
      <button type="button" className="console-preview-leave" onClick={onLeave}>
        Leave Preview
      </button>
    </div>
  )
}
