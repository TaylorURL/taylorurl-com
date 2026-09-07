import Mesh from '@components/mesh/Mesh'
import { GROUNDS } from '@constants/grounds'

/**
 * A ruled mesh of headed facts: what a service covers, what it leaves out, what
 * it costs to run.
 *
 * @param {object} props
 * @param {{ title: string, body: string }[]} props.items - The cells, in order.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the mesh sits on.
 * @param {Record<string, number>} [props.columns] - Columns per breakpoint, for
 *   a band whose density is a design decision. Left out, they follow the number
 *   of facts.
 */
export default function FactMesh({ items, ground = 'paper', columns }) {
  const tone = GROUNDS[ground]

  return (
    <Mesh items={items} ground={ground} columns={columns} scale="card" as="ul">
      {(item, index, cell) => (
        <li key={item.title} className={`flex flex-col gap-3 p-6 sm:p-7 ${tone.surface} ${cell}`}>
          <h3 className={`text-[16px] font-semibold tracking-tight ${tone.title}`}>{item.title}</h3>
          <p className={`text-[14px] leading-relaxed ${tone.body}`}>{item.body}</p>
        </li>
      )}
    </Mesh>
  )
}
