/*
 * Runs inside the page the renderer opens. Two jobs, both deterministic.
 *
 * `__fit()` makes the copy fit its box. Every piece of type that may shrink
 * carries `data-shrink` with a floor in `data-min`; the box is measured, and
 * while anything spills past it the shrinkable type steps down four percent at
 * a time. Copy that still does not fit at its floor is an error rather than a
 * card with its last line cut off, so the renderer refuses to write it.
 *
 * `__seek(t)` puts a video at second `t`. Every moving piece is a pure function
 * of `t`, with no CSS animation and no clock, which is what lets the renderer
 * ask for frame 312 and get the same frame on every run.
 */
;(() => {
  const clamp = value => Math.max(0, Math.min(1, value))
  const out = p => 1 - Math.pow(1 - clamp(p), 3)
  const inOut = p => {
    const x = clamp(p)
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  }

  const overflowing = box => {
    const frame = box.getBoundingClientRect()
    let top = Infinity
    let bottom = -Infinity
    let right = -Infinity
    for (const child of box.children) {
      const rect = child.getBoundingClientRect()
      if (!rect.height) continue
      top = Math.min(top, rect.top)
      bottom = Math.max(bottom, rect.bottom)
      right = Math.max(right, rect.right)
    }
    const wide = [...box.querySelectorAll('[data-shrink]')].some(
      el => el.scrollWidth > el.clientWidth + 1
    )
    return top < frame.top - 0.5 || bottom > frame.bottom + 0.5 || right > frame.right + 0.5 || wide
  }

  window.__fit = () => {
    const boxes = [...document.querySelectorAll('.scene')]
    if (!boxes.length) boxes.push(document.getElementById('content'))
    const problems = []
    const shrunk = []
    for (const box of boxes) {
      let guard = 0
      while (overflowing(box) && guard < 40) {
        guard += 1
        let moved = false
        for (const el of box.querySelectorAll('[data-shrink]')) {
          const size = parseFloat(el.style.fontSize)
          const min = parseFloat(el.dataset.min)
          if (size > min) {
            el.style.fontSize = `${Math.max(min, size * 0.96).toFixed(2)}px`
            moved = true
          }
        }
        if (!moved) break
      }
      if (overflowing(box))
        problems.push(
          `overflow in ${box.id || `scene ${box.dataset.scene}`}: ${box.textContent.trim().slice(0, 80)}`
        )
      for (const el of box.querySelectorAll('[data-shrink]')) {
        const size = parseFloat(el.style.fontSize)
        if (size < parseFloat(el.dataset.size) - 0.01)
          shrunk.push(`${el.dataset.size}->${size.toFixed(0)}px`)
      }
    }
    return { problems, shrunk }
  }

  const progress = document.querySelector('.progress')
  const scenes = [...document.querySelectorAll('.scene')].map(el => ({
    el,
    from: parseFloat(el.dataset.from),
    to: parseFloat(el.dataset.to),
    hold: el.dataset.hold === '1',
    parts: [...el.querySelectorAll('[data-fx]')].map(part => ({
      el: part,
      fx: part.dataset.fx,
      at: parseFloat(part.dataset.at || '0'),
      words: part.dataset.fx === 'words' ? [...part.querySelectorAll('.w')] : null,
    })),
  }))

  const apply = (part, local) => {
    const { el, fx, at } = part
    const since = local - at
    if (fx === 'fade') {
      const p = out(since / 0.6)
      el.style.opacity = p
      el.style.transform = `translateY(${((1 - p) * 36).toFixed(2)}px)`
    } else if (fx === 'words') {
      part.words.forEach((word, index) => {
        const p = out((since - index * 0.07) / 0.5)
        word.style.opacity = p
        word.style.transform = `translateY(${((1 - p) * 60).toFixed(2)}px)`
      })
    } else if (fx === 'count') {
      const from = parseFloat(el.dataset.from)
      const to = parseFloat(el.dataset.to)
      const p = out(since / parseFloat(el.dataset.dur))
      el.textContent = `${(from + (to - from) * p).toFixed(parseInt(el.dataset.decimals, 10))}${el.dataset.suffix}`
      if (el.classList.contains('fx') && !el.closest('.vrow')) {
        const shown = out(since / 0.4)
        el.style.opacity = shown
      }
    } else if (fx === 'bar') {
      const p = out(since / parseFloat(el.dataset.dur))
      el.style.width = `${(parseFloat(el.dataset.to) * p).toFixed(3)}%`
    } else if (fx === 'strike') {
      el.style.backgroundSize = `${(out(since / 0.7) * 100).toFixed(3)}% 12px`
    } else if (fx === 'pop') {
      el.style.transform = `scale(${out(since / 0.3).toFixed(4)})`
    } else if (fx === 'type') {
      const text = el.dataset.text
      const count = since <= 0 ? 0 : Math.min(text.length, Math.floor(since / 0.045) + 1)
      el.textContent = text.slice(0, count) || ' '
      el.style.opacity = since < 0 ? 0 : 1
    } else if (fx === 'scroll') {
      const p = inOut(since / parseFloat(el.dataset.dur))
      const from = parseFloat(el.dataset.from)
      const to = parseFloat(el.dataset.to)
      el.style.transform = `translateY(${(from + (to - from) * p).toFixed(2)}px)`
    } else if (fx === 'ring') {
      if (since < 0) {
        el.style.opacity = 0
        return
      }
      const phase = (since % 1.4) / 1.4
      el.style.opacity = ((1 - phase) * 0.9).toFixed(3)
      el.style.transform = `scale(${(1 + phase * 0.1).toFixed(4)}, ${(1 + phase * 0.5).toFixed(4)})`
    }
  }

  window.__seek = t => {
    const duration = window.__duration || 1
    if (progress) {
      const span = document.body.clientWidth - 192
      progress.style.width = `${((Math.min(t, duration) / duration) * span).toFixed(2)}px`
    }
    for (const scene of scenes) {
      const local = t - scene.from
      const shown = Math.min(clamp(local / 0.45), scene.hold ? 1 : clamp((scene.to - t) / 0.4))
      const visible = t >= scene.from && (scene.hold || t < scene.to)
      scene.el.style.opacity = visible ? out(shown).toFixed(4) : 0
      scene.el.style.transform = `translateY(${((1 - out(clamp(local / 0.45))) * 30).toFixed(2)}px)`
      if (!visible) continue
      for (const part of scene.parts) apply(part, local)
    }
  }
})()
