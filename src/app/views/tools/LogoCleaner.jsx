import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, ImageUp, Undo2 } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'
import StepFlow from '../start/steps/StepFlow'
import {
  REACHES,
  backgroundOf,
  coverage,
  cutout,
  flatten,
  monochrome,
  trim,
} from '@app/tools/lib/cutout'
import { zipBlob } from '@app/tools/lib/zip'
import { useToast } from '@hooks/chrome/useToast'
import { faultMessage } from '@utils/faults'
import { GROUND, SHEET } from './lib/ground'

const LABEL = 'section-label-sm mb-2 block text-paper-faint'

// What a file that would not open says. It is what `readImage` refuses with and
// what anything else thrown on the way in falls back to, because from the
// reader's side those are one event: the logo they chose did not appear.
const NOT_AN_IMAGE =
  'That file could not be opened as an image. Try a PNG, JPG or WebP export of the logo.'

// What a download that did not build says. The work happens on this machine, so
// the two things worth suggesting are the two that are actually theirs to
// change: press it again, or hand it something smaller.
const NOT_BUILT =
  'The logo files could not be built. Try the download again, or a smaller export of the logo.'

// A choice drawn as a mesh cell. The ring is inset because the cell sits inside
// the mesh's clipping shell, where a ring drawn outside the border is cut off on
// every edge the cell shares with it.
const TILE =
  'flex min-h-[44px] flex-col gap-1 p-4 text-left transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)]'

// The longest edge the preview is worked at. A logo arrives at whatever size it
// was exported and the settings are dragged rather than typed, so the picture
// under the hand has to redraw between one movement and the next. The download
// is taken from the file as supplied.
const PREVIEW_EDGE = 460

// What the archive holds, and what each one is for. `build` takes the cut image
// and returns the one to write, so a variant is a row here rather than a branch
// further down.
const VARIANTS = [
  {
    id: 'transparent',
    name: 'logo.png',
    label: 'Transparent',
    hint: 'The one to use almost everywhere.',
    always: true,
    build: image => image,
  },
  {
    id: 'black',
    name: 'logo-black.png',
    label: 'Solid Black',
    hint: 'For pale backgrounds, faxes, and one-color print.',
    build: image => monochrome(image, [0, 0, 0]),
  },
  {
    id: 'white',
    name: 'logo-white.png',
    label: 'Solid White',
    hint: 'For dark headers, photographs, and signage.',
    build: image => monochrome(image, [255, 255, 255]),
  },
  {
    id: 'on-white',
    name: 'logo-on-white.png',
    label: 'On White',
    hint: 'For anywhere that will not take a transparent file.',
    build: image => flatten(image, [255, 255, 255]),
  },
  {
    id: 'on-black',
    name: 'logo-on-black.png',
    label: 'On Black',
    hint: 'For checking the edges hold up on a dark ground.',
    build: image => flatten(image, [0, 0, 0]),
  },
]

const NOTE = `What is in this folder

logo.png            The logo with its background removed. Use this one unless
                    something refuses a transparent file.
logo-black.png      The same shape in solid black, for pale grounds and
                    one-color printing.
logo-white.png      The same shape in solid white, for dark headers and photos.
logo-on-white.png   Flattened onto white, for anywhere transparency is refused.
logo-on-black.png   Flattened onto black, which is where a bad cutout shows.

Open logo-on-black.png first. If the edges look clean there, they will look
clean anywhere.
`

// What the cut is shown against.
//
// The chequer is the one everybody already reads as nothing rather than as
// white, and its greys are fixed rather than taken from the theme: drawn in the
// site's own hairline it comes out dark on dark, which hides exactly the
// artwork a reader is checking and makes a working cutout look broken.
//
// No single ground answers, either. White artwork disappears on the chequer and
// black artwork disappears on black, so the ground is a choice, and the two
// solid ones are what a logo is actually going to be placed on.
const BACKDROPS = [
  {
    id: 'checks',
    label: 'Checker',
    style: {
      backgroundImage: 'repeating-conic-gradient(#d8d8d8 0% 25%, #f4f4f4 0% 50%)',
      backgroundSize: '16px 16px',
    },
  },
  { id: 'white', label: 'White', style: { backgroundColor: '#ffffff' } },
  { id: 'black', label: 'Black', style: { backgroundColor: '#101010' } },
]

/** An image element from a file, and the pixels behind it. */
function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(NOT_AN_IMAGE))
    }
    image.src = url
  })
}

/** The image as pixels, no larger than `edge` on its longest side. */
function pixelsOf(image, edge) {
  const scale = edge ? Math.min(1, edge / Math.max(image.width, image.height)) : 1
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

/** Pixels back to a PNG. */
function toPng({ data, width, height }) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

const hex = ([r, g, b]) => `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`

/**
 * The logo cleaner.
 *
 * Three steps: the file, the settings, and the download. The middle step is
 * where the work is, and it is arranged so that pressing next twice still gets
 * a correct result: the background is read off the border of the artwork and
 * the defaults suit a logo on a white page, which is most of what arrives.
 *
 * Everything runs in the browser. Artwork is the one thing a business has only
 * one copy of, and a tool that uploaded it somewhere to hand it back would be
 * asking for more trust than it needs.
 */
export default function LogoCleaner({ tool }) {
  const toast = useToast()
  const [image, setImage] = useState(null)
  const [fault, setFault] = useState(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [backdrop, setBackdrop] = useState('checks')
  const [chosen, setChosen] = useState(() => new Set(['transparent', 'black', 'white']))
  const [settings, setSettings] = useState({
    background: null,
    tolerance: 0.12,
    softness: 0.06,
    reach: 'outside',
    unmix: true,
    trim: true,
  })
  const fileRef = useRef(null)

  // The source at preview size, taken once per file rather than per keystroke.
  const source = useMemo(() => (image ? pixelsOf(image, PREVIEW_EDGE) : null), [image])

  // Held rather than derived on the way past: it is an array, so a fresh one
  // each render would make the cut below look changed every time and redo the
  // whole image while a slider is still moving.
  const background = useMemo(
    () => settings.background || (source ? backgroundOf(source) : [255, 255, 255]),
    [settings.background, source]
  )

  const preview = useMemo(() => {
    if (!source) return null
    const lifted = cutout(source, { ...settings, background })
    return settings.trim ? trim(lifted) : lifted
  }, [source, settings, background])

  const kept = preview ? coverage(preview) : 0

  // The file that would not open is named under the drop zone rather than in
  // the corner, because it is a fault in what was chosen and it has to still be
  // there while the reader goes and finds a different export.
  const take = useCallback(async file => {
    if (!file) return
    setFault(null)
    try {
      const loaded = await readImage(file)
      setImage(loaded)
      setSettings(held => ({ ...held, background: null }))
    } catch (cause) {
      setFault(faultMessage(cause, NOT_AN_IMAGE))
    }
  }, [])

  const set = (key, value) => setSettings(held => ({ ...held, [key]: value }))

  // Picking the ground off the artwork itself, for a logo whose border is not
  // the colour behind it.
  const pickAt = event => {
    if (!picking || !source) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - box.left) / box.width) * source.width)
    const y = Math.floor(((event.clientY - box.top) / box.height) * source.height)
    const at = (y * source.width + x) * 4
    set('background', [source.data[at], source.data[at + 1], source.data[at + 2]])
    setPicking(false)
  }

  const save = async () => {
    if (!image) return
    setBusy(true)
    try {
      // Taken again from the file as supplied, so the download is the artwork's
      // own resolution rather than the size the preview was worked at.
      const full = pixelsOf(image, 0)
      const lifted = cutout(full, { ...settings, background })
      const cut = settings.trim ? trim(lifted) : lifted

      const wanted = VARIANTS.filter(v => v.always || chosen.has(v.id))
      const files = await Promise.all(
        wanted.map(async variant => {
          const blob = await toPng(variant.build(cut))
          return { name: variant.name, bytes: new Uint8Array(await blob.arrayBuffer()) }
        })
      )
      files.push({ name: 'how-to-use-these.txt', bytes: new TextEncoder().encode(NOTE) })

      const href = URL.createObjectURL(zipBlob(files))
      const link = document.createElement('a')
      link.href = href
      link.download = 'logo-files.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch (cause) {
      // Nothing was uploaded, so a download that fails fails here: a canvas the
      // browser would not read back, or artwork large enough that building five
      // versions of it at full size runs the tab out of memory. The button goes
      // back to reading Download and leaves nothing on the page to say why, so
      // the corner is where this is said.
      toast(faultMessage(cause, NOT_BUILT), 'error')
    } finally {
      setBusy(false)
    }
  }

  const Preview = (
    <Cutout
      preview={preview}
      image={image}
      background={background}
      kept={kept}
      picking={picking}
      onPick={pickAt}
      backdrop={backdrop}
      onBackdrop={setBackdrop}
    />
  )

  const steps = [
    {
      id: 'logo-file',
      label: 'Your Logo',
      eyebrow: 'Step One',
      title: tool.name,
      description: tool.lede,
      answered: Boolean(image),
      content: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-8">
            <div>
              <p className={LABEL}>The file</p>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-dashed p-10 text-center transition duration-200 ease-out-soft focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--accent)] ${GROUND.ruleStrong} ${GROUND.wash}`}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  take(event.dataTransfer.files[0])
                }}
              >
                <ImageUp className="h-6 w-6 text-accent" aria-hidden="true" />
                <span className="text-[15px] font-medium text-ink-paper">
                  Drop a logo here, or choose a file
                </span>
                <span className={`text-[13px] ${GROUND.body}`}>PNG, JPG or WebP</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={event => take(event.target.files[0])}
                />
              </label>
              {fault && (
                <p
                  className="mt-3 text-[13px] leading-snug text-[color:var(--danger-on-paper)]"
                  role="alert"
                >
                  {fault}
                </p>
              )}
            </div>

            <div className={`border-t pt-6 ${GROUND.rule}`}>
              <p className="section-label-sm text-accent">Nothing Leaves This Page</p>
              <p className={`mt-3 text-[15px] leading-relaxed ${GROUND.body}`}>
                The logo is opened and worked on in your browser. It is never uploaded, so the only
                copy stays where it already was.
              </p>
            </div>
          </div>
          {Preview}
        </div>
      ),
    },
    {
      id: 'logo-settings',
      label: 'The Cut',
      eyebrow: 'Step Two',
      title: 'Adjust until the edges look right.',
      description:
        'The defaults suit a logo on a white page. The two that matter most are how much of the background to take and whether to reach inside the artwork.',
      answered: true,
      content: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-8">
            <div>
              <p className={LABEL}>What counts as background</p>
              <Mesh items={REACHES} columns={{ base: 1, sm: 2 }}>
                {(entry, index, cell) => {
                  const on = settings.reach === entry.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => set('reach', entry.id)}
                      aria-pressed={on}
                      className={`${TILE} ${cell} ${
                        on
                          ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                          : `${GROUND.surface} ${GROUND.title} ${GROUND.wash}`
                      }`}
                    >
                      <span className="text-[13px] font-medium leading-snug">{entry.label}</span>
                      <span className={`text-[12px] leading-snug ${on ? '' : GROUND.body}`}>
                        {entry.hint}
                      </span>
                    </button>
                  )
                }}
              </Mesh>
            </div>

            <Slider
              id="logo-tolerance"
              label="How much to take"
              value={settings.tolerance}
              onChange={value => set('tolerance', value)}
              hint="Raise it if a rim of the old background is left behind."
            />
            <Slider
              id="logo-softness"
              label="Edge softness"
              value={settings.softness}
              max={0.3}
              onChange={value => set('softness', value)}
              hint="Raise it for a photographed or scanned logo with a soft edge."
            />

            <div className={`flex flex-wrap gap-3 border-t pt-6 ${GROUND.rule}`}>
              <Toggle on={settings.trim} onClick={() => set('trim', !settings.trim)}>
                Crop to the Artwork
              </Toggle>
              <Toggle on={settings.unmix} onClick={() => set('unmix', !settings.unmix)}>
                Clean the Edge Color
              </Toggle>
              <Toggle on={picking} onClick={() => setPicking(!picking)}>
                {picking ? 'Click the Preview' : 'Pick the Background'}
              </Toggle>
              {settings.background && (
                <button
                  type="button"
                  onClick={() => set('background', null)}
                  className="btn btn-secondary"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                  Back to Automatic
                </button>
              )}
            </div>

            {kept > 0.97 && (
              <p className={`text-[14px] leading-relaxed ${GROUND.meta}`}>
                Almost nothing was removed. The background may not be a flat color, or the artwork
                may already run to every edge.
              </p>
            )}
            {kept < 0.1 && (
              <p className={`text-[14px] leading-relaxed ${GROUND.meta}`}>
                Only {Math.round(kept * 100)}% of the picture is left, which usually means the
                artwork is close in color to what it is sitting on. Lower how much to take, or pick
                the background off the preview. A logo the same color as its background cannot be
                separated from it by color alone.
              </p>
            )}
          </div>
          {Preview}
        </div>
      ),
    },
    {
      id: 'logo-download',
      label: 'Download',
      eyebrow: 'Step Three',
      title: 'Take the set.',
      description:
        'A zip holding the transparent logo and whichever versions are marked In, at the size you supplied it, with a note saying which to use where.',
      answered: true,
      content: (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="space-y-8">
            <div>
              <p className={LABEL}>What goes in the folder</p>
              <ul className={`divide-hair-paper divide-y ${GROUND.shell}`}>
                {VARIANTS.map(variant => {
                  const on = variant.always || chosen.has(variant.id)
                  return (
                    <li key={variant.id}>
                      <button
                        type="button"
                        disabled={variant.always}
                        aria-pressed={on}
                        onClick={() =>
                          setChosen(held => {
                            const next = new Set(held)
                            if (next.has(variant.id)) next.delete(variant.id)
                            else next.add(variant.id)
                            return next
                          })
                        }
                        className={`flex min-h-[44px] w-full items-start justify-between gap-4 p-4 text-left transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                          variant.always ? 'cursor-default' : GROUND.wash
                        }`}
                      >
                        <span className="flex flex-col gap-1">
                          <span className="text-[13px] font-medium leading-snug text-ink-paper">
                            {variant.label}
                          </span>
                          <span className={`text-[12px] leading-snug ${GROUND.body}`}>
                            {variant.hint}
                          </span>
                        </span>
                        <span
                          className={`section-label-sm flex-shrink-0 ${on ? 'text-accent' : GROUND.meta}`}
                        >
                          {variant.always ? 'Always' : on ? 'In' : 'Out'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={!image || busy}
              className="btn btn-primary"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Building…' : 'Download the Logo Files'}
            </button>

            <div className={`border-t pt-6 ${GROUND.rule}`}>
              <p className="section-label-sm text-accent">Check It on Black</p>
              <p className={`mt-3 text-[15px] leading-relaxed ${GROUND.body}`}>
                A cutout that looks clean on white can still carry a pale rim. Open the on-black
                version first: if the edges hold up there, they hold up anywhere.
              </p>
            </div>
          </div>
          {Preview}
        </div>
      ),
    },
  ]

  return <StepFlow steps={steps} atTop draft="iso" label="Logo cleaner steps" />
}

/**
 * The cut as it stands, on a chequerboard so transparency reads as nothing
 * rather than as white.
 *
 * It owns its canvas. Every step shows one of these, and a ref held above would
 * belong to whichever copy mounted last, which is the one already leaving as its
 * replacement arrives. The canvas then stops redrawing and every setting looks
 * like it does nothing.
 */
function Cutout({ preview, image, background, kept, picking, onPick, backdrop, onBackdrop }) {
  const ground = BACKDROPS.find(entry => entry.id === backdrop) || BACKDROPS[0]
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview) return
    canvas.width = preview.width
    canvas.height = preview.height
    canvas
      .getContext('2d')
      .putImageData(new ImageData(preview.data, preview.width, preview.height), 0, 0)
  }, [preview])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="section-label-sm text-paper-faint block">Preview</p>
        {preview && (
          <div className="flex gap-px overflow-hidden rounded-sm bg-[color:var(--paper-hairline)]">
            {BACKDROPS.map(entry => {
              const on = entry.id === ground.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onBackdrop(entry.id)}
                  aria-pressed={on}
                  className={`section-label-sm flex min-h-[44px] items-center px-3 transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                    on
                      ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)]'
                      : `${GROUND.surface} ${GROUND.meta} ${GROUND.wash}`
                  }`}
                >
                  {entry.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div
        {...SHEET.attrs}
        onClick={onPick}
        className={`flex items-center justify-center p-6 ${preview ? 'aspect-square' : ''} ${
          SHEET.shell
        } ${picking ? 'cursor-crosshair' : ''}`}
        style={ground.style}
      >
        {preview ? (
          <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className={`max-w-[24ch] text-center text-[14px] leading-relaxed ${SHEET.body}`}>
            Choose a logo and it appears here. The checkerboard stands for transparent, and the two
            solid grounds show whether the edges hold up.
          </p>
        )}
      </div>
      {preview && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className={`section-label-sm ${GROUND.meta}`}>Size</dt>
            <dd className="mt-1 text-[13px] text-ink-paper">
              {image.width} by {image.height}
            </dd>
          </div>
          <div>
            <dt className={`section-label-sm ${GROUND.meta}`}>Kept</dt>
            <dd className="mt-1 text-[13px] text-ink-paper">
              {Math.round(kept * 100)}% of the frame
            </dd>
          </div>
          <div>
            <dt className={`section-label-sm ${GROUND.meta}`}>Ground</dt>
            <dd className="mt-1 flex items-center gap-2 text-[13px] text-ink-paper">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm ring-1 ring-[color:var(--paper-hairline-strong)]"
                style={{ backgroundColor: hex(background) }}
              />
              {hex(background)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function Slider({ id, label, value, onChange, hint, max = 0.6 }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="section-label-sm text-paper-faint block">
          {label}
        </label>
        <span className={`font-mono text-[12px] tabular-nums ${GROUND.meta}`}>
          {Math.round((value / max) * 100)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={max / 100}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-[color:var(--accent)]"
      />
      <p className={`mt-2 text-[13px] leading-snug ${GROUND.body}`}>{hint}</p>
    </div>
  )
}

function Toggle({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`btn ${on ? 'btn-primary' : 'btn-secondary'}`}
    >
      {children}
    </button>
  )
}
