import { data, type SectionProps } from './types'

interface SpotlightItem {
  resource_id?: string
  title: string
  why?: string
}
interface ResourceSpotlightData {
  items?: SpotlightItem[]
}

export function ResourceSpotlightSection({ section }: SectionProps) {
  const { items = [] } = data<ResourceSpotlightData>(section)

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-4">{section.title}</h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 rounded-lg bg-cream border border-border px-4 py-3">
            <span className="text-accent text-lg leading-none mt-0.5">📄</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink leading-snug">{item.title}</p>
              {item.why && (
                <p className="text-sm text-ink-secondary leading-relaxed mt-0.5">{item.why}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
