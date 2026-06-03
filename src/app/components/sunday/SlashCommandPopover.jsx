import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Bell,
  Brain,
  CheckSquare,
  Code,
  FolderOpen,
  GitBranch,
  Home,
  Plus,
  Search,
  Wifi,
} from 'lucide-react'
import { SLASH_COMMANDS } from '@constants/sunday/slashCommands'

const ICON_MAP = {
  Bell,
  Brain,
  CheckSquare,
  Code,
  FolderOpen,
  GitBranch,
  Home,
  Plus,
  Search,
  Wifi,
}

/**
 * Floating popover that appears when the user types `/` as the first character
 * in the composer textarea. Filters commands as the user types, supports
 * keyboard navigation (Arrow Up/Down, Enter, Escape).
 *
 * Exposes `handleKeyDown(e)` via ref so the parent can intercept keyboard
 * events from the textarea before its own handler runs.
 */
const SlashCommandPopover = forwardRef(function SlashCommandPopover(
  { text, onSelect, visible },
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef(null)

  const query = visible ? text.slice(1).toLowerCase() : ''

  const filtered = useMemo(
    () => SLASH_COMMANDS.filter(cmd => cmd.command.slice(1).startsWith(query)),
    [query]
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const activeItem = listRef.current.querySelector('[data-active="true"]')
    activeItem?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const selectItem = useCallback(
    index => {
      const command = filtered[index]
      if (command) onSelect(command.fillText)
    },
    [filtered, onSelect]
  )

  const handleKeyDown = useCallback(
    e => {
      if (!visible || filtered.length === 0) return false

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filtered.length)
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
        return true
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        selectItem(selectedIndex)
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onSelect(null)
        return true
      }
      return false
    },
    [visible, filtered.length, selectedIndex, selectItem, onSelect]
  )

  useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown])

  if (!visible || filtered.length === 0) return null

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slash commands"
      className="sunday-fade-up absolute bottom-full left-0 right-0 z-50 mb-1.5 max-h-[240px] overflow-y-auto rounded-xl border shadow-lg"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px var(--sunday-border)',
      }}
    >
      {filtered.map((cmd, index) => {
        const IconComponent = ICON_MAP[cmd.icon]
        const isActive = index === selectedIndex
        return (
          <button
            key={cmd.command}
            type="button"
            role="option"
            aria-selected={isActive}
            data-active={isActive}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left"
            style={{
              background: isActive ? 'var(--sunday-accent-soft)' : 'transparent',
              transition: 'background 100ms var(--sunday-ease-out)',
            }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: isActive ? 'var(--sunday-accent)' : 'var(--sunday-surface-2)',
                color: isActive ? 'var(--sunday-on-accent)' : 'var(--sunday-text-muted)',
                transition:
                  'background 100ms var(--sunday-ease-out), color 100ms var(--sunday-ease-out)',
              }}
            >
              {IconComponent && <IconComponent size={14} strokeWidth={2} />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[14px] font-medium leading-tight"
                style={{ color: 'var(--sunday-text)' }}
              >
                {cmd.label}
                <span
                  className="ml-1.5 font-mono text-[11px] font-normal"
                  style={{ color: 'var(--sunday-text-faint)' }}
                >
                  {cmd.command}
                </span>
              </span>
              <span
                className="block text-[12px] leading-tight"
                style={{ color: 'var(--sunday-text-muted)' }}
              >
                {cmd.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
})

export default SlashCommandPopover
