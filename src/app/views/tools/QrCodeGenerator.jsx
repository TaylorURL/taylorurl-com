import { useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'
import StepFlow from '../start/steps/StepFlow'
import { LEVELS, encodeQr, maximumBytes } from '@app/tools/lib/qr'
import { qrPngBlob, qrSvg, qrSvgBlob } from '@app/tools/lib/qrRender'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { FIELD_LABEL, GROUND } from './lib/ground'

// What a code that could not be drawn says, for the causes that are not about
// what was typed. The reader has one thing they can do about any of them.
const NOT_DRAWN = 'That could not be turned into a code. Change what it points at and try again.'

// What a file that would not save says. Both formats are written here in the
// browser, so the press is the whole of what there is to try again.
const NOT_SAVED = 'That file could not be saved. Try the download again.'

// A choice drawn as a mesh cell. The ring is inset because the cell sits inside
// the mesh's clipping shell, where a ring drawn outside the border is cut off on
// every edge the cell shares with it.
const TILE =
  'flex min-h-[44px] flex-col gap-1 p-4 text-left transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]'

// What the code can point at. Each takes the fields it needs and writes the
// string a scanner hands to the phone, which is the whole difference between
// these: a scanner opens a link, offers to dial a number, or joins a network,
// according to how the text is spelled.
const KINDS = [
  {
    id: 'link',
    label: 'A Web Address',
    hint: 'Opens a page. Menus, booking, a review link.',
    fields: [{ name: 'url', label: 'Web address', placeholder: 'yourbusiness.com', type: 'text' }],
    compose: values => {
      const typed = values.url.trim()
      if (!typed) return ''
      return /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`
    },
  },
  {
    id: 'phone',
    label: 'A Phone Number',
    hint: 'Offers to dial. Cards, vehicle signs, flyers.',
    fields: [{ name: 'phone', label: 'Phone number', placeholder: '281 555 0140', type: 'tel' }],
    compose: values => {
      const digits = values.phone.replace(/[^\d+]/g, '')
      return digits ? `tel:${digits}` : ''
    },
  },
  {
    id: 'email',
    label: 'An Email Address',
    hint: 'Opens a new message already addressed.',
    fields: [
      { name: 'email', label: 'Email address', placeholder: 'you@yourbusiness.com', type: 'email' },
      { name: 'subject', label: 'Subject', placeholder: 'Quote request', type: 'text' },
    ],
    compose: values => {
      const address = values.email.trim()
      if (!address) return ''
      const subject = values.subject.trim()
      return subject
        ? `mailto:${address}?subject=${encodeURIComponent(subject)}`
        : `mailto:${address}`
    },
  },
  {
    id: 'wifi',
    label: 'Your Wifi',
    hint: 'Joins the network without anybody reading out a password.',
    fields: [
      { name: 'ssid', label: 'Network name', placeholder: 'Shop Guest', type: 'text' },
      { name: 'password', label: 'Password', placeholder: 'Leave empty if open', type: 'text' },
    ],
    compose: values => {
      const name = values.ssid.trim()
      if (!name) return ''
      // The separators carry meaning in this format, so a name or a password
      // containing one is escaped rather than splitting the string.
      const escape = text => text.replace(/([;,:"\\])/g, '\\$1')
      const password = values.password
      return password
        ? `WIFI:T:WPA;S:${escape(name)};P:${escape(password)};;`
        : `WIFI:T:nopass;S:${escape(name)};;`
    },
  },
  {
    id: 'text',
    label: 'Plain Text',
    hint: 'Shows the words. A code, a reference, a short note.',
    fields: [
      { name: 'text', label: 'Text', placeholder: 'Anything you want to appear', type: 'text' },
    ],
    compose: values => values.text.trim(),
  },
]

const EMPTY_VALUES = {
  url: '',
  phone: '',
  email: '',
  subject: '',
  ssid: '',
  password: '',
  text: '',
}

// Sizes a printer and a screen actually ask for, rather than a free number
// somebody has to guess at.
const SIZES = [
  { id: 'small', label: 'Small', pixels: 512, note: 'Cards, table tents' },
  { id: 'medium', label: 'Medium', pixels: 1024, note: 'Flyers, menus' },
  { id: 'large', label: 'Large', pixels: 2048, note: 'Posters, signs' },
]

const PRESETS = [
  { id: 'classic', label: 'Black on White', dark: '#000000', light: '#ffffff' },
  { id: 'inverted', label: 'White on Black', dark: '#ffffff', light: '#000000' },
  { id: 'ink', label: 'Ink on Paper', dark: '#1c1c1a', light: '#f7f5f0' },
]

const download = (blob, filename) => {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

/** A field name for the file, taken from what the code points at. */
function filenameFor(kind, payload) {
  const stem = payload
    .replace(/^[a-z]+:(\/\/)?/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase()
  return `qr-${stem || kind.id}`
}

/**
 * The QR code generator.
 *
 * Three steps: what the code points at, how it looks, and the download. The
 * middle step is entirely optional - the defaults are a black code on white at
 * a size that prints on a flyer, which is what almost everybody wants - so
 * pressing next twice gets a correct file.
 *
 * The code is drawn from the payload on every keystroke because the preview is
 * the only thing that tells somebody they have typed the address wrong, and a
 * code that appears only at the end is one they find out about after printing.
 */
export default function QrCodeGenerator({ tool }) {
  const toast = useToast()
  const [kindId, setKindId] = useState('link')
  const [values, setValues] = useState(EMPTY_VALUES)
  const [presetId, setPresetId] = useState('classic')
  const [levelId, setLevelId] = useState('M')
  const [sizeId, setSizeId] = useState('medium')
  const [saving, setSaving] = useState(false)

  const kind = KINDS.find(entry => entry.id === kindId)
  const preset = PRESETS.find(entry => entry.id === presetId)
  const size = SIZES.find(entry => entry.id === sizeId)
  const payload = kind.compose(values)

  const encoded = useMemo(() => {
    if (!payload) return null
    try {
      return { grid: encodeQr(payload, { level: levelId }) }
    } catch (cause) {
      // The encoder refuses exactly one thing, and it refuses it in a sentence
      // about what was typed: the payload is longer than any code holds. That
      // sentence opens with the count, which is how it has to read, so it is
      // kept as written rather than sent through the door, which reads a number
      // in that position as machine output and would replace the most useful
      // part of it. Anything else thrown in here is not about the field, and is
      // answered in the page's words rather than the encoder's. Neither goes to
      // a notice: this runs on every keystroke, and a notice per keystroke is a
      // page nobody can type on.
      const said = cause instanceof RangeError ? cause.message : faultMessage(cause, NOT_DRAWN)
      return { error: said }
    }
  }, [payload, levelId])

  const grid = encoded?.grid || null

  const preview = useMemo(
    () => (grid ? qrSvg(grid, { scale: 8, dark: preset.dark, light: preset.light }) : ''),
    [grid, preset]
  )

  const change = event => {
    const { name, value } = event.target
    setValues(held => ({ ...held, [name]: value }))
  }

  const save = async format => {
    if (!grid) return
    const options = { dark: preset.dark, light: preset.light }
    const stem = filenameFor(kind, payload)
    try {
      if (format === 'svg') {
        download(qrSvgBlob(grid, { ...options, scale: 8 }), `${stem}.svg`)
        return
      }
      setSaving(true)
      const blob = await qrPngBlob(grid, { ...options, width: size.pixels })
      // A browser that will not write the canvas out hands back nothing rather
      // than throwing, so the press that produced no file is caught here too.
      // Either way the button goes back to naming the format and the page shows
      // nothing at all, which is why this one is said in the corner.
      if (!blob) throw new Error(NOT_SAVED)
      download(blob, `${stem}.png`)
    } catch (cause) {
      toast(faultMessage(cause, NOT_SAVED), 'error')
    } finally {
      setSaving(false)
    }
  }

  const chooser = (options, current, onPick, describe) => (
    <Mesh items={options} columns={{ base: 1, sm: 3 }}>
      {(option, index, cell) => {
        const chosen = option.id === current
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onPick(option.id)}
            aria-pressed={chosen}
            className={`${TILE} ${cell} ${
              chosen
                ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                : `${GROUND.surface} ${GROUND.title} ${GROUND.wash}`
            }`}
          >
            <span className="text-[13px] font-medium leading-snug">{option.label}</span>
            <span className={`text-[12px] leading-snug ${chosen ? '' : GROUND.body}`}>
              {describe(option)}
            </span>
          </button>
        )
      }}
    </Mesh>
  )

  const steps = [
    {
      id: 'qr-points-at',
      label: 'Points At',
      eyebrow: 'Step One',
      title: tool.name,
      description: tool.lede,
      answered: Boolean(payload),
      content: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-8">
            <div>
              <p className={FIELD_LABEL}>What it should do</p>
              <Mesh items={KINDS} columns={{ base: 1, sm: 2 }}>
                {(entry, index, cell) => {
                  const chosen = entry.id === kindId
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setKindId(entry.id)}
                      aria-pressed={chosen}
                      className={`${TILE} ${cell} ${
                        chosen
                          ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                          : `${GROUND.surface} ${GROUND.title} ${GROUND.wash}`
                      }`}
                    >
                      <span className="text-[13px] font-medium leading-snug">{entry.label}</span>
                      <span className={`text-[12px] leading-snug ${chosen ? '' : GROUND.body}`}>
                        {entry.hint}
                      </span>
                    </button>
                  )
                }}
              </Mesh>
            </div>

            <div className="space-y-5">
              {kind.fields.map(field => (
                <div key={field.name}>
                  <label htmlFor={`qr-${field.name}`} className={FIELD_LABEL}>
                    {field.label}
                  </label>
                  <input
                    id={`qr-${field.name}`}
                    name={field.name}
                    type={field.type}
                    value={values[field.name]}
                    onChange={change}
                    className="field py-3.5"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              {encoded?.error && (
                <p
                  className="text-[13px] leading-snug text-[color:var(--danger-on-paper)]"
                  role="alert"
                >
                  {encoded.error}
                </p>
              )}
            </div>
          </div>

          <QrPreview svg={preview} grid={grid} payload={payload} />
        </div>
      ),
    },
    {
      id: 'qr-look',
      label: 'How It Looks',
      eyebrow: 'Step Two',
      title: 'The defaults print cleanly.',
      description:
        'Black on white at medium is what a printer expects. Change it only if the code has to sit on something that will not take it.',
      answered: true,
      content: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-8">
            <div>
              <p className={FIELD_LABEL}>Color</p>
              {chooser(PRESETS, presetId, setPresetId, option =>
                option.id === 'classic' ? 'Scans anywhere' : 'Check it scans before printing'
              )}
            </div>
            <div>
              <p className={FIELD_LABEL}>Size</p>
              {chooser(SIZES, sizeId, setSizeId, option => `${option.note}, ${option.pixels}px`)}
            </div>
            <div>
              <p className={FIELD_LABEL}>Damage it survives</p>
              {chooser(
                LEVELS.filter(level => level.id !== 'L'),
                levelId,
                setLevelId,
                option => `${Math.round(option.recovers * 100)}% obscured still scans`
              )}
              <p className={`mt-3 text-[13px] leading-relaxed ${GROUND.body}`}>
                Higher recovery makes the pattern denser. Medium is right unless the code is going
                somewhere it will be rubbed, folded or rained on.
              </p>
            </div>
          </div>

          <QrPreview svg={preview} grid={grid} payload={payload} />
        </div>
      ),
    },
    {
      id: 'qr-download',
      label: 'Download',
      eyebrow: 'Step Three',
      title: 'Take the file.',
      description:
        'PNG for anything you are sending to a printer or dropping into a document. SVG when it needs to scale to a vehicle wrap or a banner without going soft.',
      answered: true,
      content: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => save('png')}
                disabled={!grid || saving}
                className="btn btn-primary"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Preparing…' : `PNG, ${size.pixels}px`}
              </button>
              <button
                type="button"
                onClick={() => save('svg')}
                disabled={!grid}
                className="btn btn-secondary"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                SVG, any size
              </button>
            </div>

            <div className={`border-t pt-6 ${GROUND.rule}`}>
              <p className="section-label-sm text-accent">Before You Print a Thousand</p>
              <p className={`mt-3 text-[15px] leading-relaxed ${GROUND.body}`}>
                Scan it off your own screen with your own phone. A code that fails does so for a
                reason worth finding now: too small on the page, too little contrast against what it
                is printed on, or an address that was mistyped.
              </p>
            </div>

            <div className={`border-t pt-6 ${GROUND.rule}`}>
              <p className="section-label-sm text-accent">Nothing Leaves This Page</p>
              <p className={`mt-3 text-[15px] leading-relaxed ${GROUND.body}`}>
                The code is drawn in your browser. What it points at is never sent anywhere, and the
                file is yours to keep, with no watermark and nothing to sign up for.
              </p>
            </div>
          </div>

          <QrPreview svg={preview} grid={grid} payload={payload} />
        </div>
      ),
    },
  ]

  return <StepFlow steps={steps} atTop label="QR code steps" />
}

/**
 * The code as it stands, beside whichever step is being answered.
 *
 * It owns the node the markup is written into. Every step shows one of these,
 * and a ref held above would be released by the panel leaving after the panel
 * arriving had claimed it, leaving the code drawn on no step but the first.
 */
function QrPreview({ svg, grid, payload }) {
  const liveRef = useRef(null)

  // The code is written as markup rather than as an image so it stays crisp at
  // whatever the layout gives it, and it is set through a ref because the SVG is
  // generated here rather than authored.
  useEffect(() => {
    if (liveRef.current) liveRef.current.innerHTML = svg
  }, [svg])

  return (
    <div className="flex flex-col gap-4">
      <p className={FIELD_LABEL}>Preview</p>
      <div
        className={`flex items-center justify-center p-6 ${grid ? 'aspect-square' : ''} ${GROUND.shell}`}
      >
        {grid ? (
          <div ref={liveRef} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" />
        ) : (
          <p className={`max-w-[22ch] text-center text-[14px] leading-relaxed ${GROUND.body}`}>
            Fill in the field on step one and the code appears here.
          </p>
        )}
      </div>
      {grid && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className={`section-label-sm ${GROUND.meta}`}>Holds</dt>
            <dd className="mt-1 text-[13px] text-ink-paper">
              {grid.bytes} of {maximumBytes(grid.level)} characters
            </dd>
          </div>
          <div>
            <dt className={`section-label-sm ${GROUND.meta}`}>Grid</dt>
            <dd className="mt-1 text-[13px] text-ink-paper">
              {grid.size} by {grid.size}
            </dd>
          </div>
        </dl>
      )}
      {payload && <p className={`break-all text-[12px] leading-snug ${GROUND.meta}`}>{payload}</p>}
    </div>
  )
}
