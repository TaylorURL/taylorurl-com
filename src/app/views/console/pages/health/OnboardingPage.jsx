import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConsole } from '../../lib/context'
import { ConsolePage, ContactLine, Panel, PanelFoot, SkeletonBar } from '../../ui'
import { MONO_LABEL } from '../../lib/tokens'
import { currentProject } from '../../lib/stages'
import {
  BRIEF_LABELS,
  CONTEXT_LABELS,
  STEPS,
  answerAt,
  answeredField,
  onboardingPercent,
  optionsFor,
  prefill,
  stepProgress,
  stepRank,
  withAnswer,
} from '../../lib/onboarding'
import OnboardingFields from '../../intake/OnboardingFields'
import OnboardingFlow from '../../intake/OnboardingFlow'
import { useOnboardingFeed } from '@hooks/console/useOnboardingFeed'
import { useSession } from '@hooks/session/useSession'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { SUPPORT_EMAIL } from '@constants/navigation'

/**
 * The questions a build is drawn from, asked once and answered at leisure.
 *
 * This is where a client lands the moment their payment clears, and it is very
 * nearly the only section they are given until they send it: the design cannot
 * start without what is on this form, and a client left to find it in a menu is
 * a build waiting on a screen nobody opened. The tracker is what they get
 * afterwards, and it is unchanged.
 *
 * The page holds none of the answers and none of the arithmetic. The record and
 * every write to it belong to the feed, what counts as answered belongs to the
 * model, and the frame belongs to the flow. What is left here is the joining:
 * which build is being answered for, what the form opens holding, which of four
 * screens the reader is on, and one drawn step handed to the frame per entry in
 * the register.
 *
 * Nothing is asked twice. The steps answered before the card was taken were
 * answers too, and they are laid into the record as answers rather than as
 * blanks - once, when the record is first opened, so that a client who clears a
 * prefilled field is not handed it straight back. What was carried over stays
 * marked as carried in `untouched`, which is what lets the person building the
 * site tell an answer from a guess.
 *
 * Two things here could be called the brief and they are not the same row.
 * `feed` holds what this section writes, one row per build. `brief` is what was
 * answered before the card was taken, which the pay form wrote into
 * `project_briefs`, and it is read for the prefill and never written. The name
 * on screen, Your Brief, belongs to the first of the two.
 *
 * Four screens, and only one of them is the form: the read still out, no build
 * on the account at all, a brief already sent, and the questions themselves.
 * The second is the one worth being careful about, because a build is filed
 * under the address it was paid with and the likeliest reader of that screen is
 * somebody who paid from one address and signed up with another.
 */

/** The card fills the room the section was given, and the step moves inside it. */
const ROWS = 'minmax(0,1fr)'

/** What the handover says when it did not happen and nothing named a reason. */
const NOT_HANDED_OVER = 'Your brief did not go over. Everything you typed is saved, so try again.'

/**
 * What the form reads from before the record lands.
 *
 * One object rather than a fresh one per render, so nothing downstream is
 * rebuilt on every paint for the sake of an empty answer set that is the same
 * empty answer set it was last time.
 */
const NOTHING = {}

/** The days a week of opening hours is read back in. */
const DAYS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

/**
 * Whether a field is in the running for this set of answers.
 *
 * The model's own rule, which lives on the field rather than in an export: a
 * conditional field whose condition is false is not asked for, not counted and
 * not read back, so the review has to ask the same question the percent does or
 * it lists a logo picker at a client who said they have no logo.
 */
function applies(field, answers) {
  return typeof field.applies === 'function' ? field.applies(answers) === true : true
}

/** One row of a list field, in a few words. */
function rowText(item) {
  if (!item || typeof item !== 'object') return null
  if (item.day) {
    const day = DAYS[item.day] || item.day
    if (item.closed) return `${day} closed`
    return item.open && item.close ? `${day} ${item.open} to ${item.close}` : null
  }
  return item.name || item.title || item.url || item.network || null
}

/** An address in one line, or the answer that says there is not one. */
function addressText(value) {
  if (value.none) return 'No address customers visit'
  const region = [value.state, value.postal].filter(Boolean).join(' ')
  const held = [value.line1, value.line2, value.city, region]
    .map(part => String(part || '').trim())
    .filter(Boolean)
  return held.length ? held.join(', ') : null
}

/**
 * One answer as the review reads it back, or null where there is nothing there.
 *
 * Ids are turned back into the names they were chosen by, because a client
 * reading `500_2500` on a screen that is meant to be their own words has been
 * shown the database rather than their answer. A field whose options are made
 * out of other answers carries no list, and there the id is the best name there
 * is.
 */
function readable(field, value) {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return String(value)

  if (Array.isArray(value)) {
    const held = value
      .map(item => {
        if (typeof item === 'string') {
          const named = (field.options || []).find(option => option.id === item)
          return named ? named.name : item
        }
        return rowText(item)
      })
      .filter(Boolean)
    return held.length ? held.join(', ') : null
  }

  if (typeof value === 'object') return addressText(value)
  return null
}

/**
 * The step's own shape while the record is still coming.
 *
 * A label over a box, four times, at the height a field stands at. The frame
 * draws its own placeholders for the reading and the count; this is the part
 * only the step knows, and without it the card waits with an empty middle that
 * reads as a form with nothing on it.
 */
function FieldsWaiting() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      {[0, 1, 2, 3].map(row => (
        <div key={row} className="flex flex-col gap-2">
          <SkeletonBar className="w-32" />
          <SkeletonBar className="w-full max-w-[46rem]" height="h-11" />
        </div>
      ))}
    </div>
  )
}

/** A headed block of prose on a step that asks for nothing. */
function Note({ title, children }) {
  return (
    <section className="flex max-w-2xl flex-col gap-2">
      <h4 className={`${MONO_LABEL} text-paper-faint`}>{title}</h4>
      <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-paper-soft">
        {children}
      </div>
    </section>
  )
}

/**
 * The first screen, which asks for nothing and is worth the room anyway.
 *
 * A client has just paid and is being handed a form. What it costs them, what
 * they need beside them and what happens to the answers are the three things
 * they would ask before starting, and answering them here is the difference
 * between a form somebody sets an afternoon aside for and one they open, scroll
 * and close. It carries no control of its own: the frame's own Continue is
 * underneath it, and a second button here would be two ways to do one thing.
 */
function Welcome() {
  return (
    <div className="flex flex-col gap-7">
      <Note title="What This Is">
        <p>
          Nothing about your site has been drawn yet. These questions are what it gets drawn from:
          what you want the site to do, how it should look, who you are trying to reach, and which
          pages the business actually needs. Everything you answer goes straight to the person
          building it.
        </p>
      </Note>

      <Note title="How Long It Takes">
        <p>
          Fifteen to twenty minutes if you have what you need beside you. It saves as you type, so
          it can be put down and picked up as many times as it takes.
        </p>
      </Note>

      <Note title="What to Have Beside You">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Your logo, in whatever form you have it.</li>
          <li>Photographs of your own work, your crew, your shop or your trucks.</li>
          <li>The phone number and the address you want on the site.</li>
          <li>Any license or insurance number your trade has to display.</li>
          <li>The names and addresses of anybody else who should be asked things.</li>
        </ul>
        <p>
          Nothing here stops you starting. Answer what you can and leave the rest open; anything
          missing gets asked for by phone rather than holding the build up.
        </p>
      </Note>

      <Note title="What Happens When You Finish">
        <p>
          The answers land with the person building your site the moment you send them. The first
          draft is drawn from them, and you see full pages before anything is built. Nothing you
          write here is a decision you cannot take back.
        </p>
      </Note>

      <p className="text-paper-faint max-w-2xl text-[12px] leading-relaxed">
        Nothing on these pages asks for a password. If a login is ever genuinely needed for a domain
        or an account, you are asked for it by voice.
      </p>
    </div>
  )
}

/**
 * The last screen: every answer in one list, under the step it was given on.
 *
 * It is read back rather than summarised. A client is about to hand this to
 * somebody who will build a business's shopfront out of it, and the one thing
 * they are owed before they press the control is the chance to see a wrong
 * phone number sitting there in their own words.
 *
 * What is still open is named in two kinds, because they are two situations. An
 * answer that is needed holds the handover and is marked. An answer that is
 * merely open holds nothing up and is a question that gets asked on the phone
 * instead, and telling a client those are the same thing is how a form ends up
 * feeling like an exam.
 *
 * There is no control on a row. The trail across the top of the card opens
 * every step in one press and is a few lines above this, so a second way back
 * into a step would be a second thing to keep pointing at the right place.
 */
function Review({ answers, brief }) {
  const groups = STEPS.filter(step => step.fields.length).map(step => ({
    step,
    rows: step.fields
      .filter(field => applies(field, answers))
      .map(field => {
        const value = answerAt(answers, field.key)
        return { field, text: readable(field, value), answered: answeredField(field, value) }
      }),
  }))

  const rows = groups.flatMap(group => group.rows)
  const needed = rows.filter(row => row.field.required && !row.answered).length
  const open = rows.filter(row => !row.field.required && !row.answered).length

  // The rows the pay form wrote that no field asks for again. They are the
  // designs taken off the wall, the software the site works beside and the
  // mailbox the business email runs on, and the person building the site wants
  // all three without the client being asked for any of them twice.
  const context = (Array.isArray(brief) ? brief : []).filter(row =>
    CONTEXT_LABELS.includes(row?.label)
  )

  return (
    <div className="flex flex-col gap-7">
      <p className="max-w-2xl text-[13px] leading-relaxed text-paper-soft">
        {needed
          ? `${needed} ${needed === 1 ? 'answer is' : 'answers are'} still needed before this can go in. They are marked below.`
          : open
            ? `${open} ${open === 1 ? 'answer is' : 'answers are'} still open. None of them hold this up, and every one is a question you get asked on the phone instead.`
            : 'Everything asked for is answered.'}
      </p>

      {groups.map(group => (
        <section key={group.step.id} className="flex max-w-2xl flex-col gap-2">
          <h4 className={`${MONO_LABEL} text-paper-faint`}>{group.step.label}</h4>
          <dl className="flex flex-col">
            {group.rows.map(row => (
              <div
                key={row.field.key}
                className="border-hair-paper flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t py-2"
              >
                <dt className="text-[13px] text-paper-soft">{row.field.label}</dt>
                <dd className="min-w-0 max-w-[28rem] text-right text-[13px] text-ink-paper">
                  {row.text || (
                    <span className="text-paper-faint">
                      {row.field.required ? 'Not answered, and needed' : 'Not answered'}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {context.length ? (
        <section className="flex max-w-2xl flex-col gap-2">
          <h4 className={`${MONO_LABEL} text-paper-faint`}>From Your Order</h4>
          <dl className="flex flex-col">
            {context.map(row => (
              <div
                key={row.label}
                className="border-hair-paper flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t py-2"
              >
                <dt className="text-[13px] text-paper-soft">{row.label}</dt>
                <dd className="min-w-0 max-w-[28rem] text-right text-[13px] text-ink-paper">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <p className="max-w-2xl text-[13px] leading-relaxed text-paper-soft">
        Sending this hands your answers to the person building your site. It is not the last word on
        any of them: everything here can change by phone or in writing right up until the site goes
        live.
      </p>
    </div>
  )
}

/**
 * Every field on one step, in the register's own order.
 *
 * A field wanting files is handed the three things a picker needs on top of its
 * own definition, because a file leaves the browser before it is an answer and
 * the request that carries it belongs to whoever holds the connection. The
 * others take a value and give one back, which is the whole of what they do.
 */
function StepFields({ step, answers, onChange, disabled, assist, files, trade }) {
  return (
    <div className="flex flex-col gap-6">
      {step.fields
        .filter(field => applies(field, answers))
        .map(field => (
          <OnboardingFields
            key={field.key}
            field={
              field.kind === 'files'
                ? { ...field, ...files }
                : { ...field, options: optionsFor(field, answers, trade) }
            }
            value={answerAt(answers, field.key)}
            onChange={value => onChange(field.key, value)}
            disabled={disabled}
            assist={field.assist ? assist : null}
          />
        ))}
    </div>
  )
}

export default function OnboardingPage() {
  const { projectFeed, preview } = useConsole()
  const { session } = useSession()
  const toast = useToast()
  const token = session?.access_token ?? null
  const project = useMemo(() => currentProject(projectFeed.projects), [projectFeed.projects])

  // The read waits on knowing there is a build to read for. An account with no
  // project has no record here and never will until one is paid for, so asking
  // would be a request that can only come back with the nothing the tracker has
  // already come back with.
  const feed = useOnboardingFeed({
    token,
    projectId: project?.project_id ?? null,
    enabled: Boolean(token) && Boolean(project),
    preview: Boolean(preview),
  })
  const { answers, error, loading, saving, submittedAt, save, setStep, submit, refresh } = feed

  const [seeded, setSeeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // A brief that has been sent lands on the screen that says so. Nothing about
  // it is locked - the review says as much before the control is pressed - but
  // what somebody arrives at after handing it over is the confirmation rather
  // than the form they have just finished with.
  const [reading, setReading] = useState(false)

  /**
   * What the pay form was answered with, where it travels this far.
   *
   * The nine rows live in `project_briefs` and reach the console with the build
   * they belong to. A build opened before those rows existed, and one whose
   * checkout failed to write them, carry nothing, and `prefill` fills nothing
   * from a brief it was not handed - which is the same blank form somebody who
   * answered nothing before paying would get, and the right one either way.
   */
  const brief = project?.brief ?? null
  const trade = useMemo(() => {
    const row = (Array.isArray(brief) ? brief : []).find(
      entry => entry?.label === BRIEF_LABELS.trade
    )
    return row?.value || null
  }, [brief])

  /**
   * The prefill, written into the record once and never again.
   *
   * It has to be a write rather than a layer over what is drawn, and the reason
   * is what happens when somebody deletes one. A prefill re-applied on every
   * render fills any answer that is empty, so a client who clears the business
   * name to retype it watches it come back under their cursor. Written down
   * once, the answer is theirs from that moment: they can empty it, leave it
   * empty, and it stays empty.
   *
   * A record that is already carrying everything the prefill would put in it is
   * left alone, so opening the form on the tenth day is a read and nothing
   * else. A brief that has been sent is never seeded at all: the studio reads a
   * record whose `updated_at` has passed its `submitted_at` as edited after
   * sending, and a write made by opening the page would say a client changed
   * their mind when all they did was look.
   */
  useEffect(() => {
    if (seeded || loading || !answers) return
    const filled = prefill(answers, { project, brief })
    if (!submittedAt && JSON.stringify(filled) !== JSON.stringify(answers)) {
      save(filled, onboardingPercent(filled))
    }
    setSeeded(true)
  }, [seeded, loading, answers, submittedAt, project, brief, save])

  // The form is not drawn until what it opens holding is in hand. The seed is a
  // write like any other, so for one frame the record is the empty one the
  // endpoint just created, and drawing that would show a client the blank
  // version of a form that is about to be a third answered.
  const waiting = projectFeed.loading || (Boolean(project) && (loading || !seeded))

  const held = answers || NOTHING

  /**
   * Where a logo actually goes.
   *
   * The build already asks for one. `project_seed_tasks` opens every project
   * with a required item in `getting_started` that takes files, the endpoint
   * behind it signs an upload into the private bucket from ids the database
   * confirmed, and the tracker draws whatever landed. A second route for the
   * same file would be a second bucket path, a second function and a second
   * place the studio has to look, and the two would disagree the first time one
   * of them was changed.
   *
   * So the field on this form is a second door onto that one item. It is found
   * by what it is rather than by what it is called: the one item in the opening
   * stage that takes files and is required, which is the logo. Photographs are
   * the other file item and are not required, and matching on a label would
   * break the moment somebody reworded it.
   */
  const logoTask = useMemo(
    () =>
      (project?.tasks || []).find(
        task =>
          task.owner === 'client' &&
          task.stage === 'getting_started' &&
          task.kind === 'files' &&
          task.required
      ) || null,
    [project]
  )

  const change = useCallback(
    (key, value) => {
      const next = withAnswer(held, key, value)
      save(next, onboardingPercent(next))
    },
    [held, save]
  )

  /**
   * Which step the frame is holding, recorded when it is a step further on.
   *
   * The column is the furthest step reached rather than the one in front of
   * them, so going back to fix a phone number does not put somebody back on
   * step four when they next open the console. The frame keeps its own
   * high-water mark for the trail; this is the one that survives the tab
   * closing.
   */
  /**
   * The picker's three handlers, pointed at that item.
   *
   * `acting` and `sending` come off the project feed rather than off this one,
   * because the request in flight is the feed's. The list the control draws is
   * the task's own, mirrored into the answers below so the bar and the review
   * read one place rather than two.
   */
  const files = useMemo(
    () => ({
      send: file => (logoTask ? projectFeed.send(logoTask.task_id, file) : Promise.resolve(false)),
      remove: file => (file?.file_id ? projectFeed.remove(file.file_id) : Promise.resolve(false)),
      acting: projectFeed.acting,
      sending: Boolean(logoTask) && projectFeed.acting === logoTask.task_id,
    }),
    [logoTask, projectFeed]
  )

  /**
   * The files the build holds, written into the answers that count them.
   *
   * The record of what was handed over is the task's, and it has to be, because
   * that is the row the studio reads and the only one a signed upload can
   * reach. But the bar over this form counts answered fields, and the review
   * lists them, and both read the answers. Mirroring one into the other is what
   * lets the item be answered in the place it is asked without the brief
   * keeping a second copy of the truth: what is written here is a list of names
   * and paths the task already confirmed, never a claim this page made on its
   * own.
   */
  const attached = logoTask?.files
  useEffect(() => {
    if (!seeded || !attached) return
    const held = answerAt(answers || NOTHING, 'brand.logo_files')
    const same =
      Array.isArray(held) &&
      held.length === attached.length &&
      held.every((file, at) => file?.file_id === attached[at]?.file_id)
    if (same) return
    change('brand.logo_files', attached)
  }, [seeded, attached, answers, change])

  const handleStep = useCallback(
    at => {
      const step = STEPS[at]
      if (!step || stepRank(step.id) <= stepRank(feed.step)) return
      setStep(step.id)
    },
    [feed.step, setStep]
  )

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      // Whatever is still on the idle goes up first, which the record's own
      // writer does before it hands anything over, so the answers the studio
      // reads are the ones that were on screen when the control was pressed.
      await submit()
    } catch (cause) {
      // A handover the record refused comes back as a sentence in the foot,
      // and that is where it belongs. Nothing gets this far but a throw the
      // writer did not expect, and without this the control simply goes back
      // to reading Send It Over with the brief still on this side and not one
      // word anywhere on the screen about why - which is the worst thing a
      // form can do to somebody who has just finished filling it in.
      toast(faultMessage(cause, NOT_HANDED_OVER), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [submit, submitting, toast])

  const assist = useMemo(() => ({ trade, token }), [trade, token])

  /**
   * When the last write landed, which the record does not send back.
   *
   * The moment is read off the writing rather than off the row: a write that
   * has come back without a fault is a write that landed, and that is the whole
   * of what the line in the foot claims. It is deliberately not set for a write
   * that failed, because a form that says Saved over a request that did not
   * arrive is the one thing about a form that saves itself that must never
   * happen.
   */
  const [savedAt, setSavedAt] = useState(null)
  const writing = useRef(false)
  useEffect(() => {
    if (saving) {
      writing.current = true
      return
    }
    if (!writing.current) return
    writing.current = false
    if (!error) setSavedAt(new Date().toISOString())
  }, [saving, error])

  const steps = useMemo(
    () =>
      STEPS.map(step => {
        const { answered, required } = stepProgress(step, held)
        return {
          ...step,
          // A step nobody can see the state of yet holds the control that moves
          // them on, rather than opening it over a form that has not landed.
          answered: !waiting && answered >= required,
          content: waiting ? (
            <FieldsWaiting />
          ) : step.id === 'welcome' ? (
            <Welcome />
          ) : step.id === 'review' ? (
            <Review answers={held} brief={brief} />
          ) : (
            <StepFields
              step={step}
              answers={held}
              onChange={change}
              disabled={submitting}
              assist={assist}
              files={files}
              trade={trade}
            />
          ),
        }
      }),
    [held, waiting, brief, change, submitting, assist, files, trade]
  )

  // Where the client left off, taken once the record is in hand. Before that it
  // is null, which the frame reads as no instruction rather than as step one.
  const resumeAt = useMemo(() => {
    if (waiting) return null
    const at = stepRank(feed.step) - 1
    return at >= 0 ? at : 0
  }, [waiting, feed.step])

  // The stored figure is a high-water mark that stops one short of finished,
  // because only the record writes a hundred and only a submission makes it do
  // so. A form with every required answer in it reads a hundred here anyway: a
  // bar sitting at ninety-nine over a live handover control is a bar arguing
  // with the button beside it, and the client cannot tell which one is wrong.
  const live = onboardingPercent(held)
  const percent = submittedAt || live === 100 ? 100 : feed.percent
  const phone = projectFeed.phone

  // Nothing here is not the same as nothing wrong. A build is attached to the
  // account whose email matches the one the payment was made with, so the
  // likeliest reader of this screen is somebody who paid from one address and
  // signed up with another. It names the cause and gives them somebody to
  // reach, because the alternative is telling a paying customer that the thing
  // they have just bought does not exist.
  if (!projectFeed.loading && !project) {
    return (
      <ConsolePage rows="auto">
        <Panel title="Your Brief">
          {projectFeed.error ? (
            <p className="px-5 py-12 text-center text-[13px] text-paper-soft">
              {projectFeed.error}
            </p>
          ) : (
            <div className="console-nothing">
              <p>No build is open on this account yet.</p>
              <p>
                These questions belong to a build, and a build waits under the email address it was
                paid with. Signing in with that address will bring it up. If that is the address you
                used, tell us and we will move it across in a minute.
              </p>
              <ContactLine phone={phone} />
            </div>
          )}
        </Panel>
      </ConsolePage>
    )
  }

  // A read that failed with nothing behind it. A read that failed with a record
  // already in hand is a different situation and is not this one: the form
  // carries on with what it holds, and the frame's own foot says the last
  // change has not landed.
  if (project && !loading && !answers && error) {
    return (
      <ConsolePage rows="auto">
        <Panel title="Your Brief">
          <div className="console-nothing">
            <p>{error}</p>
            <p>
              Nothing you have answered is lost. It is held against your build rather than in this
              window.
            </p>
          </div>
          <PanelFoot>
            <span>The questions open again as soon as the read gets through.</span>
            <button type="button" className="btn btn-secondary-paper" onClick={refresh}>
              Try Again
            </button>
          </PanelFoot>
        </Panel>
      </ConsolePage>
    )
  }

  if (submittedAt && !reading) {
    return (
      <ConsolePage rows="auto">
        <Panel title="Your Brief" aside="All answered">
          <div className="console-nothing">
            <p>Your brief is in.</p>
            <p>
              Your answers are with the person building your site. The first message about them
              lands on the address you paid with, usually the same day.
            </p>
            <p>
              Nothing is drawn until it has been read through. When the first draft is ready you get
              whole pages rather than a description of them, and you say what changes.
            </p>
            <p>
              Anything you left open gets asked for rather than guessed at. Anything you forgot is a
              phone call:{' '}
              {phone ? (
                <>
                  <a className="console-link" href={`tel:${phone.replace(/[^0-9+]/g, '')}`}>
                    {phone}
                  </a>
                  , or{' '}
                </>
              ) : null}
              <a className="console-link" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p>
              The tracker is where the stage, the updates and everything still needed from you live
              from here on. Nothing in the brief is locked either: open it again and anything you
              change goes over the same way it did the first time.
            </p>
          </div>
          <PanelFoot>
            <Link className="btn btn-secondary-paper" to="/console/project">
              Open Your Tracker
            </Link>
            <button type="button" className="console-link" onClick={() => setReading(true)}>
              Read Your Answers
            </button>
          </PanelFoot>
        </Panel>
      </ConsolePage>
    )
  }

  return (
    <ConsolePage rows={ROWS}>
      <OnboardingFlow
        steps={steps}
        percent={percent}
        loading={waiting}
        saving={saving ? 'saving' : savedAt ? 'saved' : 'idle'}
        savedAt={savedAt}
        error={error}
        resumeAt={resumeAt}
        onStep={handleStep}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </ConsolePage>
  )
}
