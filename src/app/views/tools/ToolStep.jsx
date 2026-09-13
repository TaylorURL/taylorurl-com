import { GROUND } from './lib/ground'

/**
 * A step of a tool that makes something: its controls in the wider column, and
 * beside them the thing they are making.
 *
 * @param {{ preview: import('react').ReactNode, children: import('react').ReactNode }} props
 *   `children` are the step's controls, stacked in the order they are used.
 */
export function ToolStep({ preview, children }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
      <div className="space-y-8">{children}</div>
      {preview}
    </div>
  )
}

/**
 * A ruled note under a step's controls, headed with what it is about.
 *
 * @param {{ title: string, children: import('react').ReactNode }} props
 */
export function ToolNote({ title, children }) {
  return (
    <div className={`border-t pt-6 ${GROUND.rule}`}>
      <p className="section-label-sm text-accent">{title}</p>
      <p className={`mt-3 text-[15px] leading-relaxed ${GROUND.body}`}>{children}</p>
    </div>
  )
}
