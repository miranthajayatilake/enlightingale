import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  active?: boolean
  paused?: boolean
  onExplain?: (id: string) => void
  children: ReactNode
}

/**
 * Wraps a Canvas section. Carries the `data-canvas-section` anchor and the highlight
 * treatments the Mentor's Guided Tour drives: full accent when actively narrated, a
 * dimmer "paused" treatment during a detour (the Mentor is answering a question). The
 * hover affordance lets the user click a section to have the Mentor narrate it.
 */
export function CanvasSectionShell({ id, active = false, paused = false, onExplain, children }: Props) {
  return (
    <section
      data-canvas-section={id}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group relative scroll-mt-24 rounded-xl px-6 py-6 transition-all duration-300 border',
        active && !paused && 'border-accent/50 bg-accent-light/40 shadow-sm',
        active && paused && 'border-accent/30 bg-accent-light/20',
        !active && 'border-transparent',
      )}
    >
      {onExplain && (
        <button
          onClick={() => onExplain(id)}
          aria-label="Have Mentor explain this section"
          className="absolute right-3 top-3 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs font-medium text-accent bg-surface border border-border rounded-full px-2.5 py-1 hover:border-accent shadow-sm"
        >
          ▶ Explain this
        </button>
      )}
      {children}
    </section>
  )
}
