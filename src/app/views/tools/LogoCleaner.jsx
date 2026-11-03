import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, ImageUp, Undo2 } from 'lucide-react'
import { BUTTONS, CARD, TYPE } from '@components/kit/styles'
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
import { FIELD_FAULT, FIELD_LABEL } from '@constants/grounds'
import TilePicker from './TilePicker'
import { ToolHero, ToolNotes, ToolStep } from './parts'

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

// What is worth knowing about getting a clean cut: the note that stood beside
// the download, the two that stood under the sliders, and the one that stood
// under the file.
const NOTES = [
  {
    title: 'Check it on black.',
    body: 'A cutout that looks clean on white can still carry a pale rim. Open the on-black version first: if the edges hold up there, they hold up anywhere.',
  },
  {
    title: 'A rim of the old background left behind?',
    body: 'Raise how much to take. For a photographed or scanned logo with a soft edge, raise the edge softness instead.',
  },
  {
    title: 'Nothing leaves this page.',
    body: 'The logo is opened and worked on in your browser. It is never uploaded, so the only copy stays where it already was.',
  },
]

// What the cut is shown against.
//
// The chequer is the one everybody already reads as nothing rather than as
// white, and its greys are fixed rather than taken from the theme: drawn in the
// site's own greys it comes out dark on dark, which hides exactly the artwork a
// reader is checking and makes a working cutout look broken.
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
 * One card: the file, the settings and the download down the left, and the
 * cut as it stands on the right. It is arranged so that dropping a file and
 * pressing the download still gets a correct result: the background is read
 * off the border of the artwork and the defaults suit a logo on a white page,
 * which is most of what arrives.
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

  const toggleVariant = id =>
    setChosen(held => {
      const next = new Set(held)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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

  const result = (
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

  return (
    <>
      <ToolHero title="Lift a logo off its background." lead={tool.lede}>
        <div className={`${CARD} p-6 sm:p-8`}>
          <ToolStep
            preview={result}
            first={
              <div>
                <p className={FIELD_LABEL}>The file</p>
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] bg-[var(--card-hi)] px-6 py-10 text-center transition-colors duration-150 focus-within:shadow-[0_0_0_1px_var(--blue),0_0_0_4px_rgba(59,107,255,0.16)] hover:bg-[#262624]"
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault()
                    take(event.dataTransfer.files[0])
                  }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(59,107,255,0.16)] text-[color:var(--link)]">
                    <ImageUp className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mt-1 text-[16px] font-medium text-ink">
                    {image ? 'Choose a Different Logo' : 'Drop a Logo Here or Choose a File'}
                  </span>
                  <span className={TYPE.small}>PNG, JPG or WebP</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={event => take(event.target.files[0])}
                  />
                </label>
                {fault && (
                  <p className={FIELD_FAULT} role="alert">
                    {fault}
                  </p>
                )}
              </div>
            }
          >
            <TilePicker
              name="logo-reach"
              legend="What counts as background"
              options={REACHES}
              current={settings.reach}
              onPick={id => set('reach', id)}
              describe={entry => entry.hint}
              columns={2}
            />

            <div className="space-y-6">
              <Slider
                id="logo-tolerance"
                label="How much to take"
                value={settings.tolerance}
                onChange={value => set('tolerance', value)}
              />
              <Slider
                id="logo-softness"
                label="Edge softness"
                value={settings.softness}
                max={0.3}
                onChange={value => set('softness', value)}
              />
            </div>

            <div className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Toggle on={settings.trim} onChange={() => set('trim', !settings.trim)}>
                  Crop to the Artwork
                </Toggle>
                <Toggle on={settings.unmix} onChange={() => set('unmix', !settings.unmix)}>
                  Clean the Edge Color
                </Toggle>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setPicking(!picking)}
                  aria-pressed={picking}
                  className={picking ? BUTTONS.primary : BUTTONS.secondary}
                >
                  {picking ? 'Click the Preview' : 'Pick the Background'}
                </button>
                {settings.background && (
                  <button
                    type="button"
                    onClick={() => set('background', null)}
                    className={BUTTONS.secondary}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    Back to Automatic
                  </button>
                )}
              </div>
            </div>

            {preview && kept > 0.97 && (
              <p className={TYPE.small}>
                Almost nothing was removed. The background may not be a flat color, or the artwork
                may already run to every edge.
              </p>
            )}
            {preview && kept < 0.1 && (
              <p className={TYPE.small}>
                Only {Math.round(kept * 100)}% of the picture is left, which usually means the
                artwork is close in color to what it is sitting on. Lower how much to take, or pick
                the background off the preview. A logo the same color as its background cannot be
                separated from it by color alone.
              </p>
            )}

            <fieldset>
              <legend className={FIELD_LABEL}>What goes in the folder</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {VARIANTS.map(variant => (
                  <label
                    key={variant.id}
                    className={`relative block ${variant.always ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      name="logo-variants"
                      value={variant.id}
                      checked={variant.always || chosen.has(variant.id)}
                      disabled={variant.always}
                      onChange={() => toggleVariant(variant.id)}
                      className="sr-only"
                    />
                    <span className="choice-tile h-full flex-col !items-start gap-0.5 text-left">
                      <span>{variant.label}</span>
                      <span className="text-[13px] font-normal leading-snug text-ink-mute">
                        {variant.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={save}
              disabled={!image || busy}
              className={`${BUTTONS.primary} w-full disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Building…' : 'Download the Logo Files'}
            </button>
          </ToolStep>
        </div>
      </ToolHero>

      <ToolNotes title="Getting a clean edge" items={NOTES} />
    </>
  )
}

/**
 * The cut as it stands, on a chequerboard so transparency reads as nothing
 * rather than as white, or on either of the two grounds a logo is actually
 * placed on.
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
    <div>
      <div className="mb-2 flex min-h-[36px] items-center justify-between gap-4">
        <p className="text-[14px] font-medium leading-[1.4] text-ink-soft">Preview</p>
        {preview && (
          <div className="inline-flex gap-1 rounded-full bg-white/[0.06] p-1">
            {BACKDROPS.map(entry => {
              const on = entry.id === ground.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onBackdrop(entry.id)}
                  aria-pressed={on}
                  className={`min-h-[32px] rounded-full px-3 text-[13px] font-medium transition-colors duration-150 ${
                    on ? 'bg-white/[0.14] text-ink' : 'text-ink-mute hover:text-ink'
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
        onClick={onPick}
        className={`flex items-center justify-center overflow-hidden rounded-[12px] p-6 ${
          preview ? 'aspect-square' : 'min-h-[240px]'
        } ${picking ? 'cursor-crosshair' : ''}`}
        style={ground.style}
      >
        {preview ? (
          <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-center text-[14px] leading-[1.5] text-[rgba(20,20,19,0.62)]">
            Your logo appears here.
          </p>
        )}
      </div>
      {preview && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className={TYPE.small}>Size</dt>
            <dd className="mt-0.5 text-[15px] font-medium text-ink">
              {image.width} by {image.height}
            </dd>
          </div>
          <div>
            <dt className={TYPE.small}>Kept</dt>
            <dd className="mt-0.5 text-[15px] font-medium text-ink">
              {Math.round(kept * 100)}% of the frame
            </dd>
          </div>
          <div>
            <dt className={TYPE.small}>Ground</dt>
            <dd className="mt-0.5 flex items-center gap-2 text-[15px] font-medium text-ink">
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-full"
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

function Slider({ id, label, value, onChange, max = 0.6 }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[14px] font-medium leading-[1.4] text-ink-soft">
          {label}
        </label>
        <span className="text-[14px] tabular-nums text-ink-mute">
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
        className="w-full accent-[color:var(--blue)]"
      />
    </div>
  )
}

/** A setting that is on or off, as a choice tile that wears the ring when on. */
function Toggle({ on, onChange, children }) {
  return (
    <label className="relative block cursor-pointer">
      <input type="checkbox" checked={on} onChange={onChange} className="sr-only" />
      <span className="choice-tile">{children}</span>
    </label>
  )
}
