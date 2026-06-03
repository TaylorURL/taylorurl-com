import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@utils/cn'

/**
 * Sunday Button — shadcn-shape, theme-tokenized.
 *
 * Variants slot into Sunday's CSS vars so dark/light themes Just Work.
 * `asChild` swaps the underlying element for Radix Slot composition —
 * use it to apply Button styling to a Link, NavLink, etc.
 */
const buttonVariants = cva(
  [
    'sunday-press inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap',
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sunday-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sunday-bg)]',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'border border-[var(--sunday-accent)] bg-[var(--sunday-accent)] text-[var(--sunday-on-accent)] hover:bg-[var(--sunday-accent-bright)] hover:border-[var(--sunday-accent-bright)] hover:shadow-[0_0_0_4px_var(--sunday-accent-soft)]',
        secondary:
          'border border-[var(--sunday-border-strong)] bg-[var(--sunday-surface)] text-[var(--sunday-text)] hover:border-[var(--sunday-border-hover)]',
        ghost:
          'text-[var(--sunday-text-muted)] hover:text-[var(--sunday-text)] hover:bg-[var(--sunday-surface)]',
        outline:
          'border border-[var(--sunday-border-strong)] bg-transparent text-[var(--sunday-text-muted)] hover:text-[var(--sunday-text)] hover:border-[var(--sunday-border-hover)]',
        danger:
          'border border-[var(--sunday-danger)] bg-[var(--sunday-danger)] text-white hover:opacity-90',
        accentSoft:
          'border border-[var(--sunday-accent-soft)] bg-[var(--sunday-accent-soft)] text-[var(--sunday-accent-bright)] hover:bg-[var(--sunday-accent-softer)]',
      },
      size: {
        xs: 'h-6 px-2 text-[10.5px]',
        sm: 'h-7 px-2.5 text-[11.5px]',
        md: 'h-8 px-3 text-[12.5px]',
        lg: 'h-10 px-4 text-[13.5px]',
        icon: 'h-7 w-7 p-0',
        iconLg: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export function Button({ className, variant, size, asChild = false, type, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  )
}

export { buttonVariants }
