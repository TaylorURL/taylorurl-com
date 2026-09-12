import StaffScreen from '../StaffScreen'
import CallDesk from '../parts/CallDesk'

/**
 * The call screen, on its own.
 *
 * A representative works this with a handset in the other hand, so the shell it
 * lands in is the standalone one: the head, the column and the foot, and no
 * console around them.
 */
export default function CallPage() {
  return <CallDesk Shell={StaffScreen} />
}
