import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind-aware class composer. Concatenates strings/objects/arrays via clsx
 * and de-duplicates conflicting Tailwind utilities via twMerge so a
 * later-applied class always wins (`cn('p-2', 'p-4')` → `'p-4'`).
 *
 * Use everywhere a component accepts a `className` prop that should layer
 * on top of internal defaults.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
