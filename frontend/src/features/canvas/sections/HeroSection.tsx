import { data, type SectionProps } from './types'

interface HeroData {
  essence?: string
  emoji?: string
  stats?: { label: string; value: string }[]
}

export function HeroSection({ section }: SectionProps) {
  const { essence, emoji, stats } = data<HeroData>(section)

  return (
    <div className="text-center py-4">
      {emoji && <div className="text-5xl mb-4">{emoji}</div>}
      <h1 className="text-3xl font-semibold text-ink leading-tight">{section.title}</h1>
      {essence && (
        <p className="text-lg text-ink-secondary mt-3 max-w-xl mx-auto leading-relaxed">
          {essence}
        </p>
      )}
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap justify-center gap-8 mt-7">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-semibold text-accent">{s.value}</p>
              <p className="text-xs text-ink-muted uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
