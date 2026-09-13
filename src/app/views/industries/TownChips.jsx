import { Link } from 'react-router-dom'
import { AREAS } from '@data/towns-and-trades/areas'

/** Every town with a page of its own, each as a chip that opens it. */
export default function TownChips() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-2">
      {AREAS.map(area => (
        <li key={area.slug}>
          <Link to={`/areas/${area.slug}`} className="chip">
            {area.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
