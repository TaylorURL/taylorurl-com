import { useEffect, useRef, useState } from 'react'
import { Panel, PanelFoot } from '../ui'
import { clientAsks, stageOf } from '../lib/stages'

/**
 * The client's half of the build, and the place they actually hand it over.
 *
 * The tracker used to ask for a logo and offer a checkbox. Ticking one was a
 * claim rather than a delivery, so every file still arrived by email and the
 * console described a conversation it was not part of. This is where the ask
 * and the answer finally sit in the same place.
 *
 * What an item wants decides what it draws. A logo wants a file, the words want
 * a box to write in, and approving a design wants neither - so `kind` chooses
 * the control rather than every item getting the same tick and a footnote
 * telling the reader where to send the real thing.
 *
 * Only what has been reached is shown. An item belonging to a stage the build
 * has not got to is work the client cannot usefully do yet, and a list that
 * opens with six things outstanding on the first day reads as a bill.
 *
 * The dock in the corner keeps the count and the glance; this keeps the doing.
 * Two places show the same items on purpose - one is true wherever the reader
 * is, the other is where there is room to write a paragraph or pick a file.
 */

/** What a browser may offer for a file item. Matches the endpoint's own list. */
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'

/**
 * One written answer.
 *
 * The box holds its own draft rather than reading from the project on every
 * render, because the feed re-reads on a timer and a poll landing mid-sentence
 * would take the sentence away. What is saved flows back in when the item's
 * stored answer changes underneath it - which is what happens after a save, and
 * what happens if the same account writes from a second tab.
 */
function WrittenAsk({ task, onSave, busy }) {
  const [draft, setDraft] = useState(task.answer || '')
  const saved = useRef(task.answer || '')

  useEffect(() => {
    const held = task.answer || ''
    if (held !== saved.current) {
      saved.current = held
      setDraft(held)
    }
  }, [task.answer])

  const changed = draft.trim() !== (task.answer || '').trim()

  return (
    <div className="console-ask-body">
      <textarea
        id={`ask-${task.task_id}`}
        className="field console-ask-text"
        rows={4}
        value={draft}
        disabled={busy}
        placeholder="Write as much or as little as you like."
        onChange={event => setDraft(event.target.value)}
      />
      <div className="console-ask-actions">
        <button
          type="button"
          className="btn btn-secondary-paper console-ask-btn"
          disabled={busy || !changed}
          onClick={() => onSave(task.task_id, draft)}
        >
          {busy ? 'Saving…' : task.answer ? 'Save changes' : 'Save'}
        </button>
        {task.answer && !changed ? <span className="console-ask-note">Saved.</span> : null}
      </div>
    </div>
  )
}

/**
 * One item that wants files.
 *
 * The picker is cleared after every send so the same file can be chosen twice
 * without the browser deciding nothing changed, and so the control never sits
 * there naming a file that has already gone.
 */
function FileAsk({ task, onSend, onRemove, busy, acting }) {
  const picker = useRef(null)
  const files = task.files || []

  const choose = async event => {
    const chosen = Array.from(event.target.files || [])
    if (picker.current) picker.current.value = ''
    for (const file of chosen) await onSend(task.task_id, file)
  }

  return (
    <div className="console-ask-body">
      {files.length ? (
        <ul className="console-ask-files">
          {files.map(file => (
            <li key={file.file_id}>
              {file.url ? (
                <a className="console-link" href={file.url} target="_blank" rel="noreferrer">
                  {file.name || 'Attached file'}
                </a>
              ) : (
                <span>{file.name || 'Attached file'}</span>
              )}
              {/* Keyed on the file rather than the item, because a removal in
                  flight is against one file and the picker beside it should
                  stay usable. Pressed twice, the second call would be told
                  there is no such file, which is an error message for
                  something the reader did on purpose. */}
              <button
                type="button"
                className="console-ask-remove"
                disabled={busy || acting === file.file_id}
                onClick={() => onRemove(file.file_id)}
                aria-label={`Remove ${file.name || 'this file'}`}
              >
                {acting === file.file_id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="console-ask-actions">
        <input
          ref={picker}
          id={`ask-${task.task_id}`}
          type="file"
          className="console-ask-file"
          accept={ACCEPT}
          multiple
          disabled={busy}
          onChange={choose}
        />
        {busy ? <span className="console-ask-note">Sending…</span> : null}
      </div>
      <p className="console-ask-hint">PNG, JPG, WEBP or PDF, up to 25MB each.</p>
    </div>
  )
}

export default function ProjectAsks({ project, onTick, onAnswer, onSend, onRemove, acting }) {
  const mine = clientAsks(project)

  if (!mine.length) return null

  const outstanding = mine.filter(task => !task.done_at).length

  return (
    <Panel
      title="What We Need From You"
      aside={outstanding ? `${outstanding} outstanding` : 'All in'}
    >
      <ul className="console-asks">
        {mine.map(task => {
          const busy = acting === task.task_id
          const done = Boolean(task.done_at)
          const kind = task.kind || 'tick'
          return (
            <li key={task.task_id} className="console-ask" data-done={done}>
              <div className="console-ask-head">
                {kind === 'tick' ? (
                  <label className="console-ask-tick">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={busy}
                      onChange={event => onTick(task.task_id, event.target.checked)}
                    />
                    <span className="console-ask-label">{task.label}</span>
                  </label>
                ) : (
                  <label className="console-ask-label" htmlFor={`ask-${task.task_id}`}>
                    {task.label}
                  </label>
                )}
                <span className="console-ask-stage">{stageOf(task.stage).label}</span>
              </div>
              {task.detail ? <p className="console-ask-detail">{task.detail}</p> : null}
              {kind === 'text' ? <WrittenAsk task={task} onSave={onAnswer} busy={busy} /> : null}
              {kind === 'files' ? (
                <FileAsk
                  task={task}
                  onSend={onSend}
                  onRemove={onRemove}
                  busy={busy}
                  acting={acting}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
      <PanelFoot>
        {outstanding
          ? 'Nothing here is graded. Send what you have and we will ask if we need more.'
          : 'Everything asked for is in. Anything else you send is a phone call away.'}
      </PanelFoot>
    </Panel>
  )
}
