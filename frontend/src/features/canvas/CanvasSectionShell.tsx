import type { ReactNode } from 'react'
import type { CanvasLayout, CanvasTheme } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  active?: boolean
  paused?: boolean
  emphasis?: CanvasLayout['emphasis']
  accentTreatment?: CanvasTheme['accent_treatment']
  children: ReactNode
}

/**
 * Wraps a Canvas block. Carries the `data-canvas-section` (tour scroll target) and the
 * block-level `data-anchor` (the unit the Mentor highlights / the user can ask to explain
 * via the floating "Explain this" popup). Applies the resting treatment from the block's
 * `emphasis` + the Muse theme's `accent_treatment`, and the active/paused highlight the
 * Guided Tour drives (which always takes precedence). All colors come from design tokens.
 */
export function CanvasSectionShell({
  id,
  active = false,
  paused = false,
  emphasis = 'normal',
  accentTreatment = 'wash',
  children,
}: Props) {
  const pad = emphasis === 'lead' ? 'px-7 py-8' : emphasis === 'aside' ? 'px-5 py-5' : 'px-6 py-6'

  let resting = 'border-transparent'
  if (emphasis === 'aside') {
    resting = 'bg-cream border-border'
  } else if (emphasis === 'lead') {
    if (accentTreatment === 'wash') resting = 'bg-accent-light/30 border-accent/20'
    else if (accentTreatment === 'rule') resting = 'border-accent/30'
  }

  return (
    <section
      data-canvas-section={id}
      data-anchor={id}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group relative scroll-mt-24 rounded-xl border transition-all duration-300',
        pad,
        active && !paused && 'border-accent/50 bg-accent-light/40 shadow-sm',
        active && paused && 'border-accent/30 bg-accent-light/20',
        !active && resting,
      )}
    >
      {children}
    </section>
  )
}
