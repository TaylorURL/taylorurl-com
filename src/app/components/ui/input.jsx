import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@utils/cn'

/**
 * Sunday text input. Shares borders, padding rhythm, focus ring, and font
 * with Select and Textarea so every form field reads as the same control.
 */
const inputVariants = cva(
  [
    'block w-full rounded-md border outline-none',
    'border-[var(--sunday-border-input)] bg-[var(--sunday-surface-2)] text-[var(--sunday-text)]',
    'transition-[border-color,box-shadow] duration-150 ease-out',
    'placeholder:text-[var(--sunday-text-faint)]',
    'focus-visible:border-[var(--sunday-accent)] focus-visible:shadow-[0_0_0_3px_var(--sunday-accent-soft)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-9 px-3 text-[13.5px]',
        lg: 'h-11 px-3.5 text-[15px] font-medium',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

export const Input = forwardRef(function Input({ className, size, type = 'text', ...props }, ref) {
  return (
    <input ref={ref} type={type} className={cn(inputVariants({ size, className }))} {...props} />
  )
})

export { inputVariants }
