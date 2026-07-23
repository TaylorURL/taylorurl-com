/*
 * A stylised editor pane showing a real Spigot event handler. Tokens are
 * hand-classified (no runtime highlighter dependency) and coloured through a
 * small class map, so it renders identically at prerender time.
 */

// Token classes → colours. Kept on-theme: types in diamond-cyan, strings in a
// leaf green, the @EventHandler annotation in the page accent.
const TOKEN = {
  key: { color: '#ff8fb0' }, // keywords
  type: { color: '#7fdbe8' }, // classes / types
  str: { color: '#a6e88a' }, // strings
  num: { color: '#f2c94f' }, // numbers
  ann: { color: 'var(--c-orange)' }, // annotations (Spigot orange)
  com: { color: 'var(--ink-faint)' }, // comments
  fn: { color: '#e9edf3' }, // method names
}

const t = (text, cls) => ({ text, cls })

// The snippet, line by line, as classified token runs. A "fire wand" ability:
// sneak + right-click a blaze rod to launch a fireball on a cooldown.
const LINES = [
  [t('@EventHandler', 'ann')],
  [t('public ', 'key'), t('void ', 'key'), t('onInteract', 'fn'), t('('), t('PlayerInteractEvent', 'type'), t(' e) {')],
  [t('    Player', 'type'), t(' p = e.getPlayer();')],
  [t('    if', 'key'), t(' (!p.isSneaking()) '), t('return', 'key'), t(';')],
  [],
  [t('    ItemStack', 'type'), t(' wand = p.getInventory().getItemInMainHand();')],
  [t('    if', 'key'), t(' (wand.getType() != '), t('Material', 'type'), t('.BLAZE_ROD) '), t('return', 'key'), t(';')],
  [],
  [t('    '), t('// one fireball, then a short cooldown', 'com')],
  [t('    p.launchProjectile('), t('Fireball', 'type'), t('.'), t('class', 'key'), t(');')],
  [t('    p.setCooldown('), t('Material', 'type'), t('.BLAZE_ROD, '), t('60', 'num'), t(');')],
  [t('}')],
]

export default function SpigotCodeCard({ className = '' }) {
  return (
    <div
      className={`border-hair overflow-hidden rounded-md border bg-[color:var(--surface-1)] shadow-2xl ${className}`}
    >
      {/* Title bar */}
      <div className="border-hair flex items-center gap-3 border-b bg-[color:var(--surface-2)] px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: 'var(--c-blue)' }} />
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: 'var(--c-green)' }}
          />
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: 'var(--c-orange)' }}
          />
        </div>
        <span className="font-mono text-[11px] tracking-[0.08em] text-ink-mute">FireWand.java</span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Spigot API
        </span>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto p-5">
        <pre className="font-mono text-[12.5px] leading-[1.7] sm:text-[13px]">
          <code>
            {LINES.map((line, i) => (
              <div key={i} className="grid grid-cols-[2ch_1fr] gap-4">
                <span className="select-none text-right text-ink-faint">{i + 1}</span>
                <span className="text-ink-soft">
                  {line.length === 0
                    ? ' '
                    : line.map((tok, j) => (
                        <span key={j} style={tok.cls ? TOKEN[tok.cls] : undefined}>
                          {tok.text}
                        </span>
                      ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
