import { data, type SectionProps } from './types'

interface Stat {
  label: string
  value: string
}
interface StatBandData {
  stats?: Stat[]
}

export function StatBandSection({ section }: SectionProps) {
  const { stats = [] } = data<StatBandData>(section)

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-4">{section.title}</h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}>
        {stats.map((s, i) => (
          <div key={i} className="rounded-lg bg-cream border border-border px-4 py-5 text-center">
            <p className="text-2xl font-semibold text-ink">{s.value}</p>
            <p className="text-xs text-ink-muted mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
