import StaffScreen from '../StaffScreen'
import PortalDoors from '../parts/PortalDoors'

/**
 * The portal front, on its own.
 *
 * The doors are the same doors the console's portal draws, because they are the
 * portal rather than this route's idea of it. All this file decides is which
 * shell they land in: a screen one viewport tall with nothing else on it.
 */
export default function PortalPage() {
  return <PortalDoors Shell={StaffScreen} />
}
