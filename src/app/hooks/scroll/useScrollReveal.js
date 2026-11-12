import { useEffect } from 'react'

/**
 * whatsapp.com's arrival motion: each band rises into place the first time it
 * is scrolled to.
 *
 * Nothing is hidden until this has run. It marks every `[data-reveal]` band
 * that is already on screen as shown, then puts `wa-motion` on the root, so a
 * reader never sees the first screen blink out and back; only what is below
 * the fold waits for the scroll. Bands a later route renders are picked up by
 * watching the page for new ones. A reader who has asked for less motion gets
 * none of it.
 */
export function useScrollReveal(key) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const root = document.documentElement
    const show = element => element.setAttribute('data-shown', '')
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          show(entry.target)
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 }
    )
    const seen = new WeakSet()
    const watch = () => {
      for (const element of document.querySelectorAll('[data-reveal]:not([data-shown])')) {
        if (seen.has(element)) continue
        seen.add(element)
        const box = element.getBoundingClientRect()
        if (box.top < window.innerHeight && box.bottom > 0) show(element)
        else observer.observe(element)
      }
    }
    watch()
    root.classList.add('wa-motion')
    const mutations = new MutationObserver(watch)
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      mutations.disconnect()
      observer.disconnect()
    }
  }, [key])
}
