import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useSession } from '@hooks/session/useSession'
import { useAdminFeed } from '@hooks/console/useAdminFeed'
import { displayDomain } from '@utils/domains'
import {
  Area,
  Badge,
  ConsoleError,
  ConsolePage,
  EmptyRow,
  Panel,
  PanelBody,
  PanelFoot,
  SectionNotice,
  SkeletonRows,
  ViewNav,
} from '../../ui'
import { useView } from '../../lib/views'
import { CELL_TIGHT, FIELD, MONO_LABEL, QUIET, SELECT, TH_TIGHT } from '../../lib/tokens'
import { SiteIcon } from '../../SiteIcon'

/**
 * Who holds an account, what each of them can open, and which site belongs to
 * whom.
 *
 * People and sites are two views of one set of facts, so they are read in one
 * request and drawn beside each other. The view names which of the two is the
 * work: that roll takes the wider card with every control on its rows, and the
 * other stands beside it as a reading - a site with its owner and how many can
 * open it, a person with their role and how many sites they hold. A grant made
 * on one side lands on the other without a second look, because both are
 * redrawn from the read that follows every change and both are in view while
 * it happens.
 *
 * Neither table is wide data. An account is a name, a role and a handful of
 * sites; a site is a domain, an owner and a handful of readers. Given the whole
 * width each spends most of it on gaps between three columns, so the work takes
 * the larger share and the reading the rest, and the facts that belong to one
 * row sit close enough to read as one.
 *
 * Nothing here is what enforces any of it. The endpoint refuses any account
 * that is not an admin and each change is a database function holding its own
 * rules; this is the surface those rules are worked through.
 */

const ACCOUNT_ROLES = [
  { value: 'client', label: 'Client' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
]

// A role is read far more often than it is changed, and the three of them are
// three different amounts of reach rather than three names, so each carries its
// own tone.
const ROLE_TONE = { admin: 'accent', staff: 'warn', client: 'plain' }

// A roll of this many is one its card has to scroll, and the point at which a
// row is found faster typed than looked for. Under it a field would be chrome
// over a list read at a glance.
const SEARCHED = 10

// The one rule a reader of either roll has to know to read the chips: where a
// membership came from, and which of the two sources wins.
const DOMAIN_NOTE =
  "A signup whose email domain matches a site's own domain joins that site as a viewer on the way in, and a subdomain of that domain counts too. Anything granted here outranks that match and is never taken back by it."

/** What a role is called, falling back to whatever the row actually holds. */
function roleLabel(role) {
  return ACCOUNT_ROLES.find(known => known.value === role)?.label || role
}

/** Whether a person answers to what was typed, by name or by address. */
function personMatches(person, query) {
  const needle = query.toLowerCase()
  return (
    (person.full_name || '').toLowerCase().includes(needle) ||
    (person.email || '').toLowerCase().includes(needle)
  )
}

/** Whether a site answers to what was typed, by its domain or by who owns it. */
function siteMatches(site, query) {
  const needle = query.toLowerCase()
  return (
    site.name.toLowerCase().includes(needle) ||
    (site.owner?.full_name || '').toLowerCase().includes(needle) ||
    (site.owner?.email || '').toLowerCase().includes(needle)
  )
}

/** A site a person can open, with the way to take it back off them. */
function MemberChip({ label, source, onRemove, busy }) {
  return (
    <span
      className={`${MONO_LABEL} border-hair-paper inline-flex items-center gap-1.5 rounded-sm border bg-[color:var(--paper-field)] py-1.5 pl-2.5 pr-1.5 text-ink-paper`}
      title={source === 'domain' ? 'Joined by email domain' : 'Granted by an admin'}
    >
      <span className={source === 'domain' ? 'text-paper-soft' : 'text-ink-paper'}>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="text-paper-faint flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150 hover:text-[color:var(--danger)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">Remove {label}</span>
      </button>
    </span>
  )
}

/**
 * The role a person holds, and the picker that changes it one click in.
 *
 * A column of dropdowns is a column of chrome standing in for three words, and
 * a role is read many times for every time it is changed. Closed, the role is a
 * badge like every other state the console reports; open, it is the same select
 * it always was.
 */
function RoleControl({ role, name, locked, busy, onPick }) {
  const [open, setOpen] = useState(false)
  const tone = ROLE_TONE[role] || 'plain'

  // An admin cannot take their own role off themselves, so their own row states
  // the role and offers nothing to press.
  if (locked) {
    return (
      <Badge tone={tone} title="An admin cannot change their own role.">
        {roleLabel(role)}
      </Badge>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-sm transition-opacity duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Badge tone={tone}>{roleLabel(role)}</Badge>
        <span className="sr-only">Change the role on {name}</span>
      </button>
    )
  }

  return (
    <select
      autoFocus
      aria-label={`Role for ${name}`}
      value={role}
      disabled={busy}
      onBlur={() => setOpen(false)}
      onChange={event => {
        if (event.target.value !== role) onPick(event.target.value)
        setOpen(false)
      }}
      className={`${SELECT} w-full`}
    >
      {ACCOUNT_ROLES.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/** The picker that adds a site to a person, closed until it is asked for. */
function GrantControl({ options, onGrant, busy }) {
  const [open, setOpen] = useState(false)

  if (!options.length) return null
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={QUIET}>
        <Plus className="h-3 w-3" aria-hidden="true" />
        Add Site
      </button>
    )
  }
  return (
    <select
      autoFocus
      value=""
      disabled={busy}
      onBlur={() => setOpen(false)}
      onChange={event => {
        if (event.target.value) onGrant(event.target.value)
        setOpen(false)
      }}
      className={SELECT}
    >
      <option value="">Pick a Site</option>
      {options.map(site => (
        <option key={site.site_id} value={site.site_id}>
          {displayDomain(site.name)}
        </option>
      ))}
    </select>
  )
}

/**
 * The field that narrows a roll, between the card's head and its rows.
 *
 * It is drawn only over a roll long enough to scroll, and it holds what was
 * typed for as long as the section is open, so a roll narrowed in one view is
 * still narrowed when it stands as the reading beside the other.
 */
function SearchBar({ label, placeholder, value, onChange }) {
  return (
    <div className="border-hair-paper border-b px-5 py-3">
      <label className="block">
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className={FIELD}
        />
      </label>
    </div>
  )
}

/** The name a person goes by here, and the address under it where there is one. */
function PersonName({ person }) {
  const name = person.full_name || person.email
  return (
    <>
      <span className="block truncate font-medium text-ink-paper" title={name}>
        {name}
      </span>
      {person.full_name && (
        <span className={`${MONO_LABEL} text-paper-faint block truncate`} title={person.email}>
          {person.email}
        </span>
      )}
    </>
  )
}

/** A site's mark and domain, on one line. */
function SiteName({ site }) {
  return (
    <span className="flex items-center gap-2.5">
      <SiteIcon host={site.name} name={site.name} />
      <span
        className="min-w-0 truncate font-medium text-ink-paper"
        title={displayDomain(site.name)}
      >
        {displayDomain(site.name)}
      </span>
    </span>
  )
}

/** What a roll's rows say when there are none to draw. */
function nothing(whole, kind) {
  return whole.length ? 'Nothing matches.' : `No ${kind} yet.`
}

/** What a staff or admin account can open, which no grant on a site decides. */
function EverySite() {
  return <Badge title="Granted by the role, not by a grant on a site">Every Site</Badge>
}

/** The People card, as the work or as the reading: its count, and its search. */
function PeopleCard({ area, people, shown, query, onQuery, loading, children }) {
  return (
    <Panel
      area={area}
      title="People"
      aside={query ? `${shown.length} of ${people.length}` : `${people.length} accounts`}
      loading={loading}
    >
      {people.length >= SEARCHED && (
        <SearchBar
          label="Search Accounts"
          placeholder="Search by name or email"
          value={query}
          onChange={onQuery}
        />
      )}
      {children}
    </Panel>
  )
}

/** The Sites card, as the work or as the reading: its count, and its search. */
function SitesCard({ area, sites, shown, query, onQuery, loading, children }) {
  return (
    <Panel
      area={area}
      title="Sites"
      aside={query ? `${shown.length} of ${sites.length}` : `${sites.length} tracked`}
      loading={loading}
    >
      {sites.length >= SEARCHED && (
        <SearchBar
          label="Search Sites"
          placeholder="Search by domain or owner"
          value={query}
          onChange={onQuery}
        />
      )}
      {children}
    </Panel>
  )
}

/**
 * Every account: its role and the sites it can open, with the role changed
 * and a site granted or taken back on the row.
 */
function PeopleTable({ sites, me, acting, act, ...roll }) {
  const { people, shown, loading } = roll
  return (
    <PeopleCard {...roll}>
      <PanelBody>
        {/* Fixed columns rather than shared-out ones: a name takes its share
            of the card, a role is the width of its own picker whatever the
            card is, and the sites a person can open take everything left,
            because that is the cell that grows. */}
        <table className="console-table text-[13px]" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={`${TH_TIGHT} w-[27%]`}>
                Account
              </th>
              <th scope="col" className={`${TH_TIGHT} w-[6rem]`}>
                Role
              </th>
              <th scope="col" className={TH_TIGHT}>
                Can Open
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={[CELL_TIGHT, CELL_TIGHT, CELL_TIGHT]} rows={4} />
            ) : shown.length ? (
              shown.map(person => {
                const held = new Set(person.memberships.map(row => row.site_id))
                const key = `person:${person.profile_id}`
                return (
                  <tr key={person.profile_id} className="border-hair-paper border-t align-top">
                    <td className={CELL_TIGHT}>
                      <PersonName person={person} />
                    </td>
                    <td className={CELL_TIGHT}>
                      <RoleControl
                        role={person.role}
                        name={person.full_name || person.email}
                        locked={person.profile_id === me}
                        busy={acting === key}
                        onPick={role =>
                          act({ action: 'set_role', profile_id: person.profile_id, role }, key)
                        }
                      />
                    </td>
                    <td className={CELL_TIGHT}>
                      {person.role === 'client' ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {person.memberships.map(row => (
                            <MemberChip
                              key={row.site_id}
                              label={displayDomain(row.name)}
                              source={row.source}
                              busy={acting === key}
                              onRemove={() =>
                                act(
                                  {
                                    action: 'revoke',
                                    site_id: row.site_id,
                                    profile_id: person.profile_id,
                                  },
                                  key
                                )
                              }
                            />
                          ))}
                          <GrantControl
                            busy={acting === key}
                            options={sites.filter(site => !held.has(site.site_id))}
                            onGrant={siteId =>
                              act(
                                {
                                  action: 'grant',
                                  site_id: siteId,
                                  profile_id: person.profile_id,
                                  role: 'viewer',
                                },
                                key
                              )
                            }
                          />
                        </div>
                      ) : (
                        <EverySite />
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <EmptyRow cols={3}>{nothing(people, 'accounts')}</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        <p className="leading-relaxed">{DOMAIN_NOTE}</p>
      </PanelFoot>
    </PeopleCard>
  )
}

/**
 * The people as the reading beside the sites: each with their role and how
 * many sites they hold, which is what a reader handing out a site wants to
 * know about the person they are handing it to.
 */
function PeopleRoll(roll) {
  const { people, shown, loading } = roll
  return (
    <PeopleCard {...roll}>
      <PanelBody>
        <table className="console-table text-[13px]" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={`${TH_TIGHT} w-[50%]`}>
                Account
              </th>
              <th scope="col" className={`${TH_TIGHT} w-[22%]`}>
                Role
              </th>
              <th scope="col" className={`${TH_TIGHT} w-[28%] text-right`}>
                Sites
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={[CELL_TIGHT, CELL_TIGHT, CELL_TIGHT]} rows={5} />
            ) : shown.length ? (
              shown.map(person => (
                <tr key={person.profile_id} className="border-hair-paper border-t">
                  <td className={CELL_TIGHT}>
                    <PersonName person={person} />
                  </td>
                  <td className={CELL_TIGHT}>
                    <Badge tone={ROLE_TONE[person.role] || 'plain'}>{roleLabel(person.role)}</Badge>
                  </td>
                  <td className={`${CELL_TIGHT} text-right`}>
                    {person.role === 'client' ? (
                      <span
                        className={`font-mono tabular-nums ${person.memberships.length ? 'text-ink-paper' : 'text-paper-faint'}`}
                      >
                        {person.memberships.length}
                      </span>
                    ) : (
                      <EverySite />
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={3}>{nothing(people, 'accounts')}</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
    </PeopleCard>
  )
}

/**
 * Every site: whose it is and who can open it, with the owner picked and a
 * reader taken back on the row.
 */
function SitesTable({ people, acting, act, ...roll }) {
  const { sites, shown, loading } = roll
  return (
    <SitesCard {...roll}>
      <PanelBody>
        <table className="console-table text-[13px]" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={`${TH_TIGHT} w-[34%]`}>
                Site
              </th>
              <th scope="col" className={`${TH_TIGHT} w-[24%]`}>
                Owner
              </th>
              <th scope="col" className={TH_TIGHT}>
                Readers
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={[CELL_TIGHT, CELL_TIGHT, CELL_TIGHT]} rows={5} />
            ) : shown.length ? (
              shown.map(site => {
                const key = `site:${site.site_id}`
                return (
                  <tr key={site.site_id} className="border-hair-paper border-t align-top">
                    <td className={CELL_TIGHT}>
                      <SiteName site={site} />
                      <span className={`${MONO_LABEL} text-paper-faint block`}>
                        {(site.origins || []).length} origins
                      </span>
                      {/* The key belongs to the site rather than to a column
                          of its own: it is copied out once when a site is
                          wired up and read almost never after that. */}
                      <span className="block break-all font-mono text-[12px] text-paper-soft">
                        {site.site_key}
                      </span>
                    </td>
                    <td className={CELL_TIGHT}>
                      <select
                        aria-label={`Owner of ${displayDomain(site.name)}`}
                        value={site.owner?.profile_id || ''}
                        disabled={acting === key}
                        onChange={event =>
                          act(
                            {
                              action: 'set_owner',
                              site_id: site.site_id,
                              profile_id: event.target.value || null,
                            },
                            key
                          )
                        }
                        className={`${SELECT} w-full`}
                      >
                        <option value="">Nobody</option>
                        {people.map(person => (
                          <option key={person.profile_id} value={person.profile_id}>
                            {person.full_name || person.email}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={CELL_TIGHT}>
                      {site.members.length ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {site.members.map(member => (
                            <MemberChip
                              key={member.profile_id}
                              label={member.email}
                              source={member.source}
                              busy={acting === key}
                              onRemove={() =>
                                act(
                                  {
                                    action: 'revoke',
                                    site_id: site.site_id,
                                    profile_id: member.profile_id,
                                  },
                                  key
                                )
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <span className={`${MONO_LABEL} text-paper-faint`}>Nobody yet</span>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <EmptyRow cols={3}>{nothing(sites, 'sites')}</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
      <PanelFoot>
        <p className="leading-relaxed">{DOMAIN_NOTE}</p>
      </PanelFoot>
    </SitesCard>
  )
}

/**
 * The sites as the reading beside the people: each with its owner and how
 * many can open it, so a site nobody owns or nobody reads is found without
 * leaving the roll a grant is made on.
 */
function SitesRoll(roll) {
  const { sites, shown, loading } = roll
  return (
    <SitesCard {...roll}>
      <PanelBody>
        <table className="console-table text-[13px]" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col" className={`${TH_TIGHT} w-[48%]`}>
                Site
              </th>
              <th scope="col" className={`${TH_TIGHT} w-[32%]`}>
                Owner
              </th>
              <th scope="col" className={`${TH_TIGHT} w-[20%] text-right`}>
                Readers
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={[CELL_TIGHT, CELL_TIGHT, CELL_TIGHT]} rows={5} />
            ) : shown.length ? (
              shown.map(site => (
                <tr key={site.site_id} className="border-hair-paper border-t">
                  <td className={CELL_TIGHT}>
                    <SiteName site={site} />
                  </td>
                  <td className={CELL_TIGHT}>
                    {site.owner ? (
                      <span className="block truncate" title={site.owner.email}>
                        {site.owner.full_name || site.owner.email}
                      </span>
                    ) : (
                      <span className="text-paper-faint">Nobody</span>
                    )}
                  </td>
                  <td
                    className={`${CELL_TIGHT} text-right font-mono tabular-nums ${site.members.length ? 'text-ink-paper' : 'text-paper-faint'}`}
                  >
                    {site.members.length}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={3}>{nothing(sites, 'sites')}</EmptyRow>
            )}
          </tbody>
        </table>
      </PanelBody>
    </SitesCard>
  )
}

/** The two rolls the section keeps, one view each. */
const ADMIN_VIEWS = [
  { key: 'people', label: 'People' },
  { key: 'sites', label: 'Sites' },
]

export default function AdminPage() {
  const { session } = useSession()
  const token = session?.access_token ?? null
  const { data, error, loading, acting, act } = useAdminFeed({ token, enabled: Boolean(token) })

  const people = data?.people || []
  const sites = data?.sites || []
  const me = session?.user?.id ?? null
  const [view, go] = useView(ADMIN_VIEWS)
  const [peopleQuery, setPeopleQuery] = useState('')
  const [sitesQuery, setSitesQuery] = useState('')

  const byName = [...sites].sort((a, b) => a.name.localeCompare(b.name))
  const shownPeople = peopleQuery
    ? people.filter(person => personMatches(person, peopleQuery))
    : people
  const shownSites = sitesQuery ? byName.filter(site => siteMatches(site, sitesQuery)) : byName

  // A refusal with nothing behind it is the whole answer, so it is shown in
  // place of the tables rather than above two empty ones.
  if (error && !data) return <SectionNotice>{error}</SectionNotice>

  const peopleRoll = {
    people,
    shown: shownPeople,
    query: peopleQuery,
    onQuery: setPeopleQuery,
    loading,
  }
  const sitesRoll = {
    sites: byName,
    shown: shownSites,
    query: sitesQuery,
    onQuery: setSitesQuery,
    loading,
  }

  return (
    <ConsolePage
      areas={view === 'people' ? ['nav nav', 'people sites'] : ['nav nav', 'sites people']}
      cols="minmax(0,1.6fr) minmax(0,1fr)"
      rows="auto minmax(0,1fr)"
    >
      <Area area="nav">
        <ConsoleError>{error}</ConsoleError>
        <ViewNav
          views={[
            { key: 'people', label: 'People', count: people.length, loading },
            { key: 'sites', label: 'Sites', count: sites.length, loading },
          ]}
          current={view}
          onPick={go}
          label="Admin views"
        />
      </Area>

      {view === 'people' ? (
        <>
          <PeopleTable
            area="people"
            {...peopleRoll}
            sites={byName}
            me={me}
            acting={acting}
            act={act}
          />
          <SitesRoll area="sites" {...sitesRoll} />
        </>
      ) : (
        <>
          <SitesTable area="sites" {...sitesRoll} people={people} acting={acting} act={act} />
          <PeopleRoll area="people" {...peopleRoll} />
        </>
      )}
    </ConsolePage>
  )
}
