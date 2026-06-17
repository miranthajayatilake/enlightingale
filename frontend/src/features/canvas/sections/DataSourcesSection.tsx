import { anchor, data, type SectionProps } from './types'

const TYPE_ICON: Record<string, string> = {
  url:  '🔗',
  pdf:  '📄',
  text: '📝',
}

interface SourceItem {
  title: string
  type?: string
  domain?: string | null
  snippet?: string
}

interface DataSourcesData {
  summary?: string
  sources?: SourceItem[]
}

export function DataSourcesSection({ section }: SectionProps) {
  const { summary, sources = [] } = data<DataSourcesData>(section)

  return (
    <div>
      <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-1">{section.title}</h2>
      {summary && (
        <p className="text-sm text-ink-secondary mb-4">{summary}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sources.map((source, i) => (
          <div
            key={i}
            data-anchor={anchor(section, `s${i}`)}
            className="flex gap-3 rounded-lg bg-cream border border-border px-4 py-3"
          >
            <span className="text-xl shrink-0 mt-0.5 leading-none">
              {TYPE_ICON[source.type ?? 'url'] ?? '📄'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink leading-snug line-clamp-2">
                {source.title}
              </p>
              {source.domain && (
                <p className="text-xs text-ink-muted mt-0.5">{source.domain}</p>
              )}
              {source.snippet && (
                <p className="text-xs text-ink-secondary leading-relaxed mt-1 line-clamp-2">
                  {source.snippet}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
