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
import { DataSourcesSection } from './DataSourcesSection'
import { PullQuoteSection } from './PullQuoteSection'
import { CalloutSection } from './CalloutSection'
import { GapsSection } from './GapsSection'
import { TakeawaysSection } from './TakeawaysSection'
import { GenericBlock } from './GenericBlock'

const REGISTRY: Record<CanvasSectionType, FC<SectionProps>> = {
  hero: HeroSection,
  prose: ProseSection,
  key_concepts: KeyConceptsSection,
  timeline: TimelineSection,
  comparison: ComparisonSection,
  stat_band: StatBandSection,
  resource_spotlight: ResourceSpotlightSection,
  data_sources: DataSourcesSection,
  pull_quote: PullQuoteSection,
  callout: CalloutSection,
  gaps: GapsSection,
  takeaways: TakeawaysSection,
}

/** Resolve a block type to its renderer, falling back to a safe generic block for
 *  unknown (AI-composed) kinds — the renderer is total (PRD v0.4 KD1). */
export function getSectionComponent(type: string): FC<SectionProps> {
  return REGISTRY[type as CanvasSectionType] ?? GenericBlock
}

export type { SectionProps }
