/**
 * A capture committed in both palettes, with the ground picking between them.
 *
 * A shot of a page carries the ground it was taken on, so a light capture on a
 * dark plane is a white rectangle in the middle of a dark page. Both palettes
 * are captured for that reason, and the question is only which one the reader
 * is shown.
 *
 * Asking React was the obvious answer and it was the wrong one. Every route is
 * rendered to markup at build time, where there is no reader and no setting,
 * so the served page carries the light shot; hydration adopts that markup and
 * does not patch an attribute it disagrees with, which leaves a reader in dark
 * looking at the light capture with nothing that will ever correct it. Nor does
 * the picker reach it afterwards - the theme hook holds its state per call site,
 * so the control moves its own copy and this one keeps whatever it mounted on.
 *
 * So the pair is drawn in the markup and CSS chooses, off the same `data-theme`
 * the stylesheet's palettes already hang on. That is stamped before the first
 * paint and restamped the moment the picker moves, so the shot is right on
 * arrival, right through hydration, and right on the toggle - none of which
 * depends on a component having rendered. The one that is not showing is
 * `display: none` and lazily loaded, so it never enters a viewport and its
 * bytes are never asked for.
 *
 * @param {string} props.base - the light capture's path, without extension. The
 *   dark one is the same name with `-dark`, and the narrow cuts add the width.
 * @param {number} props.narrow - the width of the narrow cut, in pixels.
 */
export default function PaletteShot({ base, narrow, alt, width, height, sizes, className = '' }) {
  return ['light', 'dark'].map(palette => {
    const src = palette === 'dark' ? `${base}-dark` : base
    return (
      <img
        key={palette}
        data-palette={palette}
        src={`${src}.webp`}
        srcSet={`${src}-${narrow}.webp ${narrow}w, ${src}.webp ${width}w`}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`palette-shot ${className}`}
      />
    )
  })
}
