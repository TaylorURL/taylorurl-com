import { BIO_NAME } from '@lib/mail/bio.js'
import { retryable } from '@utils/retryImage'

/** The photograph's own proportions, which every size below keeps. */
const PHOTO = { width: 2000, height: 1092 }

/** The widths the photograph is saved at in `public/images`. */
const WIDTHS = [360, 720, 1440]

const SRC_SET = WIDTHS.map(width => `/images/trenton-taylor-photo-${width}.webp ${width}w`).join(
  ', '
)

/**
 * Trenton's photograph, at whatever size the surface draws it.
 *
 * The face is what tells a reader who they are dealing with, so it hangs where
 * the site says who answers: the about page, the home page's who-builds-it band,
 * the contact page, the start page and the head of the chat panel. Drawing it
 * from one place keeps the sources, the frame and the retry ladder the same on
 * all of them - an `<img>` that fails never asks again, and a byline with an
 * empty box where the face goes is worse than no byline.
 *
 * The photograph is drawn whole, at its own proportions, never cut to a square.
 * `size` is its height; the width follows from it, so a caller that asked for
 * 56 gets a picture 56 tall and as wide as the photograph is at that height.
 *
 * `alt` is the name for a portrait that stands on its own. One drawn beside the
 * name passes an empty string, so a screen reader does not read the name twice.
 */
export default function Portrait({ size = 80, alt = BIO_NAME, eager = false, className = '' }) {
  const width = Math.round((size * PHOTO.width) / PHOTO.height)
  return (
    <img
      src={`/images/trenton-taylor-photo-${WIDTHS[1]}.webp`}
      srcSet={SRC_SET}
      sizes={`${width}px`}
      alt={alt}
      width={width}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ width, height: size }}
      className={`border-hair-paper-strong shrink-0 rounded-md border object-cover ${className}`}
      {...retryable()}
    />
  )
}
