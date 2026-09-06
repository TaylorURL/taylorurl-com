import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import Mesh from '@components/Mesh'
import SpotlightCard from '@reactbits/SpotlightCard/SpotlightCard'
import { GROUNDS } from '@constants/grounds'

/**
 * The tools as a row of cards, each opening its own page.
 *
 * @param {{ tools: Array<object>, ground?: string, columns?: object }} props
 */
export default function ToolCards({ tools, ground = 'paper', columns }) {
  const tone = GROUNDS[ground]

  return (
    <Mesh items={tools} ground={ground} columns={columns} scale="card">
      {(tool, index, cell) => {
        const Mark = tool.mark
        return (
          <Link
            key={tool.path}
            to={tool.path}
            className={`group block transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)] ${tone.surface} ${tone.wash} ${cell}`}
          >
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
                {tool.name}
              </h3>
              <p className={`text-[14px] leading-relaxed ${tone.body}`}>{tool.summary}</p>
            </SpotlightCard>
          </Link>
        )
      }}
    </Mesh>
  )
}
