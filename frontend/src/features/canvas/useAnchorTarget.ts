import { useCallback, useEffect, useState, type RefObject } from 'react'

export interface AnchorTarget {
  anchorId: string
  x: number
  y: number
  selectedText?: string
}

/** Walk up from a node to the nearest element carrying a `data-anchor`. */
function nearestAnchorId(node: Node | null): string | null {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null)
  while (el) {
    const id = el.getAttribute('data-anchor')
    if (id) return id
    el = el.parentElement
  }
  return null
}

/**
 * Watches the Canvas for a click or text selection and resolves it to the nearest
 * `data-anchor` — the dynamic, position-aware target for the "Explain this" popup
 * (PRD v0.4 §6.4). Ignores interactive controls so it never hijacks buttons/links.
 * Dismisses on scroll, Escape, or an empty click.
 */
export function useAnchorTarget(containerRef: RefObject<HTMLElement | null>): {
  target: AnchorTarget | null
  clear: () => void
} {
  const [target, setTarget] = useState<AnchorTarget | null>(null)
  const clear = useCallback(() => setTarget(null), [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseUp = (e: MouseEvent) => {
      const origin = e.target as HTMLElement | null
      // A click on the popup must pass through untouched, or clearing the target here would
      // unmount the button before its own click handler fires.
      if (origin?.closest('[data-explain-popup]')) return
      // Never hijack other interactive controls (buttons, links, fields).
      if (origin?.closest('button, a, input, textarea')) {
        setTarget(null)
        return
      }
      const sel = window.getSelection()
      const text = sel && !sel.isCollapsed ? sel.toString().trim() : ''
      const node = text && sel?.anchorNode ? sel.anchorNode : origin
      const anchorId = nearestAnchorId(node)
      if (!anchorId) {
        setTarget(null)
        return
      }
      setTarget({ anchorId, x: e.clientX, y: e.clientY, selectedText: text || undefined })
    }

    const onScroll = () => setTarget(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTarget(null) }

    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKey)
    }
  }, [containerRef])

  return { target, clear }
}
