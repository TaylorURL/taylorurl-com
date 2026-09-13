import { ArrowUpRight, Check } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'
import ToolMesh from '@components/mesh/ToolMesh'
import BlockHead from './BlockHead'
import DesignChoice from './DesignChoice'
import PortfolioPreview from '@components/mockups/PortfolioPreview'
import { BLOCK_LABEL, BLOCK_META, GROUND } from '../lib/ground'

// The one live site fills the block, and the jobs the site has to do sit two
// to a row from the first breakpoint with room for the pair.
const LEAD_COLUMNS = { base: 1 }
const NEEDS_COLUMNS = { base: 1, sm: 2 }

/**
 * The client site built for this trade, turned on its side so the strongest
 * case the step can make is also the largest thing in it.
 */
function LeadWork({ project, cell }) {
  return (
    <article className={`grid ${GROUND.surface} ${cell} md:grid-cols-[1.15fr_1fr]`}>
      <div
        className={`bg-surface-1 aspect-[16/10] w-full overflow-hidden border-b md:aspect-auto md:border-b-0 md:border-r ${GROUND.rule}`}
      >
        <PortfolioPreview project={project} />
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className={BLOCK_LABEL}>{project.tagline}</p>
          {project.town && <p className={BLOCK_META}>{project.town}, Texas</p>}
        </div>
        <h4 className="display-5 font-semibold leading-tight tracking-tightest text-ink-paper">
          {project.name}
        </h4>
        <p className="text-[15px] leading-relaxed text-paper-soft sm:text-[16px]">
          {project.description}
        </p>
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="border-hair-paper-strong group mt-auto inline-flex min-h-[44px] items-center gap-2 self-start border-b pb-1 text-[14px] font-semibold text-ink-paper transition duration-200 ease-out-soft hover:text-accent"
        >
          {project.displayUrl}
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      </div>
    </article>
  )
}

/**
 * The work step: the site already live for this trade, the designs the visitor
 * takes off the wall, what a site for the trade has to do, and the software it
 * runs beside.
 *
 * The software is a control because what a shop actually uses is the part of
 * the configuration only the visitor knows; the ticks travel with the inquiry
 * rather than being asked for a second time in the message. It is the same
 * panel the industry pages draw, handed a toggle.
 *
 * @param {{ trade: object, lead: object | null, designOptions: Array<object>,
 *   designs: string[], onToggleDesign: (value: string) => void,
 *   tools: Array<object>, chosenTools: string[],
 *   onToggleTool: (id: string) => void }} props
 */
export default function WorkSection({
  trade,
  lead,
  designOptions,
  designs,
  onToggleDesign,
  tools,
  chosenTools,
  onToggleTool,
}) {
  return (
    <div className="flex flex-col gap-16">
      {lead && (
        <div>
          <BlockHead label="Live Work" meta={trade.name} />
          <Mesh items={[lead]} ground="paper" columns={LEAD_COLUMNS}>
            {(project, index, cell) => <LeadWork key={project.url} project={project} cell={cell} />}
          </Mesh>
        </div>
      )}

      <DesignChoice options={designOptions} chosen={designs} onToggle={onToggleDesign} />

      <div>
        <BlockHead label="What the Site Does" meta={trade.name} />
        <Mesh items={trade.needs} ground="paper" columns={NEEDS_COLUMNS} as="ul">
          {(need, index, cell) => (
            <li
              key={need}
              className={`flex items-start gap-4 p-6 text-[15px] leading-snug text-ink-paper ${cell}`}
            >
              <Check
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                strokeWidth={2}
                aria-hidden="true"
              />
              {need}
            </li>
          )}
        </Mesh>
      </div>

      <div>
        <BlockHead label="What It Works Alongside" meta="Check the ones you use" />
        <ToolMesh tools={tools} ground="paper" chosen={chosenTools} onToggle={onToggleTool} />
      </div>
    </div>
  )
}
