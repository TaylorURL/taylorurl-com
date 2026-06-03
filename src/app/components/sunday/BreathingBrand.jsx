/**
 * The "S" brand mark, with a soft accent halo that breathes behind it.
 * The breath is what sells the "Sunday is alive" feeling on the nav.
 */
export default function BreathingBrand({ size = 28, label = 'S' }) {
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* breathing accent halo */}
      <span
        className="sunday-breath absolute inset-0 rounded-[10px]"
        style={{
          background: 'var(--sunday-accent)',
          filter: 'blur(10px)',
          opacity: 0.55,
        }}
      />
      {/* foreground gradient tile */}
      <span
        className="relative flex h-full w-full items-center justify-center rounded-[8px] font-bold leading-none"
        style={{
          background:
            'linear-gradient(135deg, var(--sunday-accent-bright) 0%, var(--sunday-accent) 100%)',
          color: 'var(--sunday-on-accent)',
          fontSize: Math.round(size * 0.52),
          letterSpacing: '-0.02em',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.15)',
        }}
      >
        {label}
      </span>
    </div>
  )
}
