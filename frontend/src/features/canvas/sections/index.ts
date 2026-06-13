import type { FC } from 'react'
import type { CanvasSectionType } from '@/lib/api'
import type { SectionProps } from './types'
import { HeroSection } from './HeroSection'
import { ProseSection } from './ProseSection'
import { KeyConceptsSection } from './KeyConceptsSection'
import { TimelineSection } from './TimelineSection'
import { ComparisonSection } from './ComparisonSection'
import { StatBandSection } from './StatBandSection'
import { ResourceSpotlightSection } from './ResourceSpotlightSection'
import { GapsSection } from './GapsSection'
import { TakeawaysSection } from './TakeawaysSection'

const REGISTRY: Record<CanvasSectionType, FC<SectionProps>> = {
  hero: HeroSection,
  prose: ProseSection,
  key_concepts: KeyConceptsSection,
  timeline: TimelineSection,
  comparison: ComparisonSection,
  stat_band: StatBandSection,
  resource_spotlight: ResourceSpotlightSection,
  gaps: GapsSection,
  takeaways: TakeawaysSection,
}

/** Resolve a section type to its renderer, falling back to prose for unknown types. */
export function getSectionComponent(type: string): FC<SectionProps> {
  return REGISTRY[type as CanvasSectionType] ?? ProseSection
}

export type { SectionProps }
