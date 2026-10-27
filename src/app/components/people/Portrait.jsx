import { BIO_NAME } from '@lib/mail/bio.js'
import { retryable } from '@utils/retryImage'

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
 * `alt` is the name for a portrait that stands on its own. One drawn beside the
 * name passes an empty string, so a screen reader does not read the name twice.
 */
export default function Portrait({ size = 80, alt = BIO_NAME, eager = false, className = '' }) {
  return (
    <img
      src="/images/trenton-taylor.webp"
      srcSet="/images/trenton-taylor.webp 1x, /images/trenton-taylor@2x.webp 2x"
      alt={alt}
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      style={{ width: size, height: size }}
      className={`border-hair-paper-strong shrink-0 rounded-md border object-cover ${className}`}
      {...retryable()}
    />
  )
}
