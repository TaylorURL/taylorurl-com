import { MarkPanel, MarkSquare, MarkSteps } from '@components/marks/marks'

/**
 * The panel beside the form for somebody who has just paid.
 *
 * The other panel makes the case for holding an account, which is the right
 * thing to say to a reader deciding whether to sign up and the wrong thing to
 * say to one who has already bought. A buyer is not choosing; they have just handed a
 * form a thousand dollars and want to know what becomes of it. So this says that instead, and says it in the order it happens.
 *
 * The three asks named at the end are the three the tracker opens with, seeded
 * against every project as it is created. Naming them here means the first
 * screen after a payment and the first screen after that agree, and a buyer can
 * go and find their logo before the console has finished loading.
 */
const STEPS = [
  {
    mark: MarkSquare,
    label: 'Your Payment Is In',
    line: 'The build is paid for and the monthly starts today, on the same card.',
  },
  {
    mark: MarkPanel,
    label: 'Your Build Opens',
    line: 'Set a password from the emailed link and your console is there, with your project already on it.',
  },
  {
    mark: MarkSteps,
    label: 'Three Things to Start',
    line: 'Your logo, your words, and photographs of your own work if you have them.',
  },
]

export default function AuthNext({ business }) {
  return (
    <div className="auth-case">
      <div className="auth-case-body">
        <p className="auth-case-eyebrow">What Happens Next</p>
        <h2 className="auth-case-head">
          {business ? `The build for ${business} is open.` : 'Your build is open.'}
        </h2>

        <ul className="auth-case-list">
          {STEPS.map(step => (
            <li key={step.label} className="auth-case-item">
              <step.mark className="auth-case-mark" aria-hidden="true" />
              <div>
                <p className="auth-case-label">{step.label}</p>
                <p className="auth-case-line">{step.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
