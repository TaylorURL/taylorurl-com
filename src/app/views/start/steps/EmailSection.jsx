import Mesh from '@components/mesh/Mesh'
import { EMAIL_PROVIDERS } from '@data/towns-and-trades/trades'
import BlockHead from './BlockHead'
import { BLOCK_LABEL, GROUND } from '../lib/ground'

const CELL_FOCUS =
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2'

// The four parts of the email service sit two to a row from the first
// breakpoint with room for the pair, and four divides that exactly.
const COLUMNS = { base: 1, sm: 2 }

// What the email service covers, in the order it happens: the address, the
// mailboxes behind it, the routing on top of it, and the move onto it.
const EMAIL_SERVICE = [
  {
    title: 'Your Own Address',
    body: 'Mail at yourbusiness.com rather than a free account with the business name in front of it.',
  },
  {
    title: 'Mailboxes for the Team',
    body: 'One for the shop and one for each person, created and handed over working.',
  },
  {
    title: 'Forwarding and Aliases',
    body: 'Sales, service, and billing addresses all landing wherever they should land.',
  },
  {
    title: 'Moved Across',
    body: 'Old mail, contacts, and calendars carried over from whatever runs it today.',
  },
]

/**
 * Business email, part of what the build covers on every path through the
 * configurator because every trade on the list needs an address that reads as
 * the business.
 *
 * The provider choice is what decides how the move is done, so it is asked
 * here and travels with the inquiry.
 *
 * @param {{ provider: string | null, onSelect: (id: string) => void }} props
 */
export default function EmailSection({ provider, onSelect }) {
  return (
    <div>
      <BlockHead label="Business Email" meta="Part of the build" />
      <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <Mesh items={EMAIL_SERVICE} ground="paper" columns={COLUMNS} as="ul" className="h-fit">
          {(item, index, cell) => (
            <li key={item.title} className={`flex flex-col gap-3 p-6 ${GROUND.surface} ${cell}`}>
              <h3 className="text-[16px] font-semibold tracking-tight text-ink-paper">
                {item.title}
              </h3>
              <p className={`text-[14px] leading-relaxed ${GROUND.body}`}>{item.body}</p>
            </li>
          )}
        </Mesh>

        <fieldset className="edge m-0 bg-paper p-6 sm:p-8">
          <legend className={BLOCK_LABEL}>Where Your Email Lives Now</legend>
          <div className={`mt-4 flex flex-col ${GROUND.shell}`}>
            {EMAIL_PROVIDERS.map(option => {
              const Mark = option.mark
              const checked = option.id === provider
              return (
                <label
                  key={option.id}
                  className={`relative flex cursor-pointer border-t first:border-t-0 ${GROUND.rule}`}
                >
                  <input
                    type="radio"
                    name="email-provider"
                    value={option.id}
                    checked={checked}
                    onChange={() => onSelect(option.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={`${CELL_FOCUS} flex w-full items-center gap-3.5 px-4 py-3.5 transition duration-200 ease-out-soft ${
                      checked
                        ? 'bg-[color:var(--accent-fill)] text-[color:var(--on-accent)] peer-focus-visible:outline-[color:var(--on-accent)]'
                        : 'bg-paper text-ink-paper hover:bg-[color:var(--wash-paper)] peer-focus-visible:outline-accent'
                    }`}
                  >
                    <Mark className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <span className="text-[14px] font-medium leading-snug">{option.name}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <p className={`mt-5 text-[14px] leading-relaxed ${GROUND.body}`}>
            Google Workspace and Microsoft 365 are set up and moved across directly. Whatever runs
            your mail today, the move is handled the same way.
          </p>
        </fieldset>
      </div>
    </div>
  )
}
