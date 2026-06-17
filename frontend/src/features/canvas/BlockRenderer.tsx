import type { CanvasSection, CanvasTheme } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CanvasSectionShell } from './CanvasSectionShell'
import { getSectionComponent } from './sections'

interface Props {
  section: CanvasSection
  theme?: CanvasTheme
  active?: boolean
  paused?: boolean
  museId?: string
  onFocusedResearch?: (focus: string) => void
  focusedResearchPending?: boolean
}

/**
 * Renders one free-form Canvas block (v0.4): resolves its component, applies the
 * per-block `layout` width and the Muse `theme`, and wraps it in the shell that carries
 * the anchor + tour highlight. The component map falls back to a safe generic block.
 */
export function BlockRenderer({
  section,
  theme,
  active,
  paused,
  museId,
  onFocusedResearch,
  focusedResearchPending,
}: Props) {
  const Component = getSectionComponent(section.type)
  const width = section.layout?.width ?? 'full'
  const widthClass = width === 'wide' ? 'lg:-mx-6' : width === 'half' ? 'sm:max-w-md' : ''

  return (
    <div className={cn(widthClass)}>
      <CanvasSectionShell
        id={section.id}
        active={active}
        paused={paused}
        emphasis={section.layout?.emphasis}
        accentTreatment={theme?.accent_treatment}
      >
        <Component
          section={section}
          theme={theme}
          museId={museId}
          onFocusedResearch={onFocusedResearch}
          focusedResearchPending={focusedResearchPending}
        />
      </CanvasSectionShell>
    </div>
  )
}
