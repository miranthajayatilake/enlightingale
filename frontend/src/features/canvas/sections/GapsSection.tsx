import { data, type SectionProps } from './types'

interface GapsData {
  items?: string[]
}

export function GapsSection({ section, onFocusedResearch, focusedResearchPending }: SectionProps) {
  const { items = [] } = data<GapsData>(section)

  if (items.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-1">{section.title}</h2>
      <p className="text-sm text-ink-muted mb-4">Worth exploring next to deepen this Muse.</p>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-warning" />
            <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
              <span className="text-sm text-ink-secondary leading-relaxed">{item}</span>
              {onFocusedResearch && (
                <button
                  onClick={() => onFocusedResearch(item)}
                  disabled={focusedResearchPending}
                  className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {focusedResearchPending ? 'Starting…' : 'Research this →'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
