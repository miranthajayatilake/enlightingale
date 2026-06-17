import type { CanvasSection, CanvasTheme } from '@/lib/api'

export interface SectionProps {
  section: CanvasSection
  theme?: CanvasTheme
  museId?: string
  onFocusedResearch?: (focus: string) => void
  focusedResearchPending?: boolean
}

/** Narrow a section's loosely-typed `data` to an expected shape. */
export function data<T>(section: CanvasSection): T {
  return section.data as unknown as T
}

/**
 * Build a `data-anchor` id for an addressable unit within a block. MUST match the
 * backend's anchor scheme (services/canvas/generator.py `_extract_anchors`): the block
 * id itself, `{id}.t` for the title, and `{id}.{prefix}{index}` per item (c/e/r/s/i/p).
 * The Mentor's Walkthrough Plan and click-to-explain resolve clicks against these ids.
 */
export function anchor(section: CanvasSection, suffix?: string): string {
  return suffix ? `${section.id}.${suffix}` : section.id
}
