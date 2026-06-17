import { cn } from '@/lib/utils'
import { anchor, data, type SectionProps } from './types'

interface HeroData {
  essence?: string
  emoji?: string
  stats?: { label: string; value: string }[]
}

export function HeroSection({ section, theme }: SectionProps) {
  const { essence, emoji, stats } = data<HeroData>(section)
  const motif = emoji || theme?.motif
  const style = theme?.hero_style ?? 'bold'

  return (
    <div className="text-center py-4">
      {motif && (
        <div className={cn('mb-4', style === 'quiet' ? 'text-4xl' : style === 'editorial' ? 'text-5xl' : 'text-6xl')}>
          {motif}
        </div>
      )}
      <h1
        data-anchor={anchor(section, 't')}
        className={cn(
          'font-semibold text-ink leading-tight',
          style === 'quiet' ? 'text-2xl' : style === 'editorial' ? 'text-3xl tracking-tight' : 'text-4xl',
        )}
      >
        {section.title}
      </h1>
      {style === 'editorial' && <div className="mx-auto mt-4 h-0.5 w-16 rounded-full bg-accent/50" />}
      {essence && (
        <p
          data-anchor={anchor(section, 'p0')}
          className="text-lg text-ink-secondary mt-3 max-w-xl mx-auto leading-relaxed"
        >
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
