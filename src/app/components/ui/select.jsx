import { forwardRef } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@utils/cn'

/**
 * Sunday Select — Radix-headed dropdown that matches Input/Textarea chrome.
 * Visual states: same border / focus ring as text inputs; dropdown panel
 * uses the elevated surface + matching border-strong.
 *
 * Usage:
 *   <Select value={value} onValueChange={setValue}>
 *     <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">Option A</SelectItem>
 *       <SelectItem value="b">Option B</SelectItem>
 *     </SelectContent>
 *   </Select>
 */
export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

const TRIGGER_SIZES = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3 text-[13.5px]',
  lg: 'h-11 px-3.5 text-[15px] font-medium',
}

export const SelectTrigger = forwardRef(function SelectTrigger(
  { className, children, size = 'md', ...props },
  ref
) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex w-full items-center justify-between gap-2 rounded-md border outline-none',
        'border-[var(--sunday-border-input)] bg-[var(--sunday-surface-2)] text-[var(--sunday-text)]',
        'transition-[border-color,box-shadow] duration-150 ease-out',
        'data-[placeholder]:text-[var(--sunday-text-muted)]',
        'focus-visible:border-[var(--sunday-accent)] focus-visible:shadow-[0_0_0_3px_var(--sunday-accent-soft)]',
        'data-[state=open]:border-[var(--sunday-accent)] data-[state=open]:shadow-[0_0_0_3px_var(--sunday-accent-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        TRIGGER_SIZES[size] ?? TRIGGER_SIZES.md,
        className
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className="shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180"
          style={{ color: 'var(--sunday-text-muted)' }}
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})

export const SelectContent = forwardRef(function SelectContent(
  { className, children, position = 'popper', sideOffset = 6, ...props },
  ref
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border shadow-2xl',
          'border-[var(--sunday-border-input)] bg-[var(--sunday-surface-2)] text-[var(--sunday-text)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})

export const SelectItem = forwardRef(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-3 pr-8 text-[13px] outline-none',
        'transition-colors duration-100',
        'data-[highlighted]:bg-[var(--sunday-surface-3)] data-[highlighted]:text-[var(--sunday-text)]',
        'data-[state=checked]:font-medium data-[state=checked]:text-[var(--sunday-accent-bright)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
        <Check size={12} strokeWidth={2.4} style={{ color: 'var(--sunday-accent-bright)' }} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
})

export const SelectSeparator = forwardRef(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px', className)}
      style={{ background: 'var(--sunday-border)' }}
      {...props}
    />
  )
})
