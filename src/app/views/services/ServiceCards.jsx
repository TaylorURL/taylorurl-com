import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'
import { GROUNDS } from '@constants/grounds'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'

/**
 * One card's face: the page's own mark, name, and summary, so the card says the
 * same thing the menu row for it says, lit where the pointer is.
 *
 * @param {object} props
 * @param {{ name: string, summary: string, mark?: Function }} props.page
 * @param {object} props.tone - The ground's classes, from `@constants/grounds`.
 */
export function PageCard({ page, tone }) {
  const Mark = page.mark
  return (
    <SpotlightCard
      className="flex h-full flex-col gap-4 bg-transparent p-6 sm:p-7"
      spotlightColor="var(--spotlight)"
    >
      <div className="flex items-start justify-between gap-4">
        {Mark && <Mark className="h-6 w-6 text-accent" />}
        <ArrowUpRight
          className={`h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${tone.meta}`}
          aria-hidden="true"
        />
      </div>
      <h3
        className={`text-[16px] font-semibold tracking-tight transition-colors duration-200 group-hover:text-accent ${tone.title}`}
      >
        {page.name}
      </h3>
      <p className={`text-[14px] leading-relaxed ${tone.body}`}>{page.summary}</p>
    </SpotlightCard>
  )
}

/**
 * The other pages a service page leads to, drawn as one ruled mesh of links.
 *
 * @param {object} props
 * @param {{ path: string, name: string, summary: string, mark: Function }[]} props.pages
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the mesh sits on.
 * @param {Record<string, number>} [props.columns] - Columns per breakpoint, for
 *   a band whose density is a design decision. Left out, they follow the number
 *   of pages.
 */
export default function ServiceCards({ pages, ground = 'paper', columns }) {
  const tone = GROUNDS[ground]

  return (
    <Mesh items={pages} ground={ground} columns={columns} scale="card">
      {(page, index, cell) => (
        <Link key={page.path} to={page.path} className={`group block ${tone.surface} ${cell}`}>
          <PageCard page={page} tone={tone} />
        </Link>
      )}
    </Mesh>
  )
}
