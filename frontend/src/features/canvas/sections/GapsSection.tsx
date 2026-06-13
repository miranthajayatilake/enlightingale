import { data, type SectionProps } from './types'

interface GapsData {
  items?: string[]
}

export function GapsSection({ section }: SectionProps) {
  const { items = [] } = data<GapsData>(section)

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-1">{section.title}</h2>
      <p className="text-sm text-ink-muted mb-4">Worth exploring next to deepen this Muse.</p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-warning" />
            <span className="text-sm text-ink-secondary leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
