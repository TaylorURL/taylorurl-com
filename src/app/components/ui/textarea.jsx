import { forwardRef } from 'react'
import { cn } from '@utils/cn'

/**
 * Sunday multi-line input. Same chrome as Input; resize defaults to vertical.
 */
export const Textarea = forwardRef(function Textarea({ className, rows = 5, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'block w-full resize-y rounded-md border px-3 py-2.5 text-[13.5px] leading-relaxed outline-none',
        'border-[var(--sunday-border-input)] bg-[var(--sunday-surface-2)] text-[var(--sunday-text)]',
        'transition-[border-color,box-shadow] duration-150 ease-out',
        'placeholder:text-[var(--sunday-text-faint)]',
        'focus-visible:border-[var(--sunday-accent)] focus-visible:shadow-[0_0_0_3px_var(--sunday-accent-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
