import { Link } from 'react-router-dom'
import Mesh from '@components/mesh/Mesh'
import { GROUNDS } from '@constants/grounds'
import { PageCard } from '../services/ServiceCards'

/**
 * The tools as a row of cards, each opening its own page.
 *
 * @param {{ tools: Array<object>, ground?: string, columns?: object }} props
 */
export default function ToolCards({ tools, ground = 'paper', columns }) {
  const tone = GROUNDS[ground]

  return (
    <Mesh items={tools} ground={ground} columns={columns} scale="card">
      {(tool, index, cell) => (
        <Link
          key={tool.path}
          to={tool.path}
          className={`group block transition duration-200 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--accent)] ${tone.surface} ${tone.wash} ${cell}`}
        >
          <PageCard page={tool} tone={tone} />
        </Link>
      )}
    </Mesh>
  )
}
