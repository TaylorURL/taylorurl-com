import { useEffect, useMemo, useRef } from 'react'
import { useConsole } from '../lib/context'
import {
  Area,
  ConsolePage,
  Panel,
  PanelBody,
  PanelFoot,
  SkeletonBar,
  SkeletonBox,
  SkeletonList,
} from '../ui'
import { STAGES, currentProject, stageOf, stageRank } from '../lib/stages'
import ProjectAsks from '../ProjectAsks'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { ZONE } from '@lib/time/zone.js'

/**
 * Where a client watches their site being made.
 *
 * The bar across the top is the whole shape of the work, so somebody two weeks
 * in can see both what is happening and how much is left without asking. Only
 * one side of it moves on its own: stages advance when the person building the
 * site advances them, and the panel in the corner is the client's half.
 *
 * Underneath is what has actually been written to them, newest first, with the
 * pictures attached to each. This is the part that makes the bar believable -
 * a stage that says Design with nothing under it is a progress bar, and a
 * stage that says Design above a picture of their own home page is a report.
 *
 * Every update closes on a phone number rather than a reply box. A client with
 * a question about their own site should be able to ask it and get an answer,
 * which a form cannot promise and a person can.
 */

/**
 * The band across the top holds its own height and the two cards under it
 * share what is left. The bar is a fixed shape however far the build has got,
 * so it is given exactly the room it draws in; the asks and the updates are
 * as long as the build makes them and move inside their own cards.
 */
const ROWS = 'auto minmax(0,1fr)'

/**
 * The asks card is the client's half of the build and the updates are the
 * studio's, and the two are read against each other: a logo asked for on the
 * left is a design that cannot start on the right. Side by side they stay in
 * one view. The updates take the wider column because a capture of a page
 * needs the width and a text box does not.
 */
const SPLIT = 'minmax(0,2fr) minmax(0,3fr)'

// The asks card names no cell of its own and holds its list outside a
// scrolling body, so it is given both by the cell it stands in: the card
// fills the cell, and the list moves between the card's head and foot the
// way every other list in the console does, so a build asking for three
// paragraphs is not a card with its foot cut off.
const ASKS_CELL =
  '[&>*]:min-h-0 [&>*]:flex-1 [&_.console-asks]:min-h-0 [&_.console-asks]:flex-1 [&_.console-asks]:overflow-y-auto [&_.console-asks]:overscroll-contain'

export default function ProjectPage() {
  const { projectFeed } = useConsole()
  const { projects, loading, error, phone, tick, answer, send, remove, markSeen, acting } =
    projectFeed
  const project = useMemo(() => currentProject(projects), [projects])

  // A finished tracker is marked seen the first time its owner reads it, which
  // is the whole meaning of the column: the studio can tell a launch that was
  // announced from one that was merely recorded. Guarded by a ref rather than
  // by the flag alone, because the write and the re-read that follows it are
  // not instant and the sixty-second poll would otherwise fire it again.
  const marked = useRef(null)
  useEffect(() => {
    if (!project || project.status !== 'complete' || project.seen_at) return
    if (marked.current === project.project_id) return
    marked.current = project.project_id
    markSeen(project.project_id)
  }, [project, markSeen])

  if (loading) {
    return (
      <ConsolePage areas={['track', 'updates']} rows={ROWS}>
        {/* The same anatomy as the band it stands in for - head, track, foot -
            at the same height, because the row under it is sized from what is
            left, and a placeholder taller than the bar moves both cards under
            it when the build lands. */}
        <Panel title="Your Site" loading area="track">
          <SkeletonBox height="43px" />
          <PanelFoot>
            <SkeletonBar className="w-72" height="h-5" />
          </PanelFoot>
        </Panel>
        <Panel title="Updates" loading area="updates">
          <PanelBody>
            <SkeletonList rows={3} />
          </PanelBody>
        </Panel>
      </ConsolePage>
    )
  }

  // Nothing here is the same as nothing wrong. A build is attached to the
  // account whose email matches the one the payment was made with, so the
  // likeliest reader of this screen is somebody who paid from one address and
  // signed up with another - and the old copy told them their build did not
  // exist. It names the cause and gives them somebody to reach, because this
  // is the one screen in the console a paying customer can reach by accident.
  if (!project) {
    return (
      <ConsolePage rows="auto">
        <Panel title="Your Site">
          {error ? (
            <p className="px-5 py-12 text-center text-[13px] text-paper-soft">{error}</p>
          ) : (
            <div className="console-nothing">
              <p>No build is open on this account yet.</p>
              <p>
                If you have paid, the build is waiting under the email address you paid with.
                Signing in with that address will bring it up. If that is the address you used, tell
                us and we will move it across in a minute.
              </p>
              <p>
                {phone ? (
                  <>
                    <a className="console-link" href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>
                      {phone}
                    </a>
                    {' or '}
                  </>
                ) : null}
                <a className="console-link" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          )}
        </Panel>
      </ConsolePage>
    )
  }

  const reached = stageRank(project.stage)
  const here = stageOf(project.stage)
  const updates = project.updates || []
  const complete = project.status === 'complete'

  // The asks card draws nothing until there is something the client can do,
  // and a cell held for it would be a hole beside the updates until then. It
  // is asked the same question it asks itself, so the page knows whether the
  // card will stand before laying out around it.
  const asked = (project.tasks || []).some(
    task => task.owner === 'client' && stageRank(task.stage) <= reached
  )

  return (
    <ConsolePage
      areas={asked ? ['track track', 'asks updates'] : ['track', 'updates']}
      cols={asked ? SPLIT : 'minmax(0,1fr)'}
      rows={ROWS}
    >
      <Panel
        title={project.business_name || 'Your Site'}
        aside={complete ? 'Finished' : `Stage ${reached} of ${STAGES.length}`}
        area="track"
      >
        <ol className="console-track" aria-label="Progress">
          {STAGES.map((stage, index) => (
            <li
              key={stage.id}
              className="console-track-step"
              data-state={
                index + 1 < reached || complete ? 'done' : index + 1 === reached ? 'here' : 'ahead'
              }
              aria-current={index + 1 === reached && !complete ? 'step' : undefined}
            >
              <span className="console-track-dot" aria-hidden="true" />
              <span className="console-track-label">{stage.label}</span>
            </li>
          ))}
        </ol>
        <PanelFoot>
          {complete
            ? 'Your site is live. Everything below is the record of how it was built.'
            : here.blurb}
        </PanelFoot>
      </Panel>

      {asked ? (
        <Area area="asks" className={ASKS_CELL}>
          <ProjectAsks
            project={project}
            onTick={tick}
            onAnswer={answer}
            onSend={send}
            onRemove={remove}
            acting={acting}
          />
        </Area>
      ) : null}

      <Panel
        title="Updates"
        loading={loading}
        aside={updates.length ? `${updates.length} so far` : null}
        area="updates"
      >
        <PanelBody>
          {updates.length ? (
            <ul className="console-updates">
              {updates.map(update => (
                <li key={update.update_id} className="console-update">
                  <div className="console-update-head">
                    <h3>{update.title}</h3>
                    <span>{stageOf(update.stage).label}</span>
                  </div>
                  {update.body ? <p className="console-update-body">{update.body}</p> : null}
                  {update.media?.length ? (
                    <div className="console-update-shots">
                      {update.media.map(shot => (
                        <figure key={shot.path}>
                          <img
                            src={shot.url || shot.path}
                            alt={shot.caption || update.title}
                            loading="lazy"
                            width={shot.width || undefined}
                            height={shot.height || undefined}
                          />
                          {shot.caption ? <figcaption>{shot.caption}</figcaption> : null}
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  <time dateTime={update.published_at}>
                    {new Date(update.published_at).toLocaleDateString(undefined, {
                      timeZone: ZONE,
                      day: 'numeric',
                      month: 'long',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-12 text-center text-[13px] text-paper-soft">
              Nothing written yet. The first update lands once your project is picked up.
            </p>
          )}
        </PanelBody>
        <PanelFoot>
          {/* One element, not several. The foot pushes its children to
              opposite ends, which is right for a note against a total and
              wrong for a sentence: handed three nodes it spreads them across
              the card and the reader gets a phone number stranded in the
              middle of a line. */}
          <span>
            {phone ? (
              <>
                Any question about your site is a phone call.{' '}
                <a className="console-link" href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>
                  {phone}
                </a>
                , or{' '}
                <a className="console-link" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </>
            ) : (
              <>
                Any question about your site, write to{' '}
                <a className="console-link" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </>
            )}
          </span>
        </PanelFoot>
      </Panel>
    </ConsolePage>
  )
}
