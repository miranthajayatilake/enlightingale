import type { CanvasSection } from '@/lib/api'

export interface SectionProps {
  section: CanvasSection
  museId?: string
  onFocusedResearch?: (focus: string) => void
  focusedResearchPending?: boolean
}

/** Narrow a section's loosely-typed `data` to an expected shape. */
export function data<T>(section: CanvasSection): T {
  return section.data as unknown as T
}
