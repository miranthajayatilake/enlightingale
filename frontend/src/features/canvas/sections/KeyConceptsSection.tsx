import { useState } from 'react'
import { cn } from '@/lib/utils'
import { anchor, data, type SectionProps } from './types'

interface Concept {
  term: string
  definition: string
}
interface KeyConceptsData {
  concepts?: Concept[]
}

// Presentational constellation — a static radial layout with SVG connectors.
// NOT an interactive graph (that's the Phase 2 Visual Explorer).
export function KeyConceptsSection({ section }: SectionProps) {
  const { concepts = [] } = data<KeyConceptsData>(section)
  const [selected, setSelected] = useState(0)

  if (concepts.length === 0) {
    return (
      <div>
        <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-3">{section.title}</h2>
      </div>
    )
  }

  const ring = concepts.slice(0, 8)
  const overflow = concepts.slice(8)

  // Polar positions (percentages within the relative box), starting at the top.
  const positions = ring.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ring.length
    return {
      x: 50 + 38 * Math.cos(angle),
      y: 50 + 40 * Math.sin(angle),
    }
  })

  const active = concepts[selected]

  return (
    <div>
      <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-4">{section.title}</h2>

      <div className="relative w-full" style={{ height: 320 }}>
        <svg className="absolute inset-0 w-full h-full text-accent/30" aria-hidden>
          {positions.map((p, i) => (
            <line
              key={i}
              x1="50%"
              y1="50%"
              x2={`${p.x}%`}
              y2={`${p.y}%`}
              stroke="currentColor"
              strokeWidth={1.5}
            />
          ))}
        </svg>

        {/* Center hub */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-accent-light border-2 border-accent/40 flex items-center justify-center text-center px-2"
          style={{ left: '50%', top: '50%' }}
        >
          <span className="text-xs font-semibold text-accent-text leading-tight">Core ideas</span>
        </div>

        {/* Concept chips */}
        {ring.map((c, i) => (
          <button
            key={c.term}
            data-anchor={anchor(section, `c${i}`)}
            onClick={() => setSelected(i)}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[40%] truncate',
              i === selected
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-ink border-border hover:border-accent hover:text-accent'
            )}
            style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}
            title={c.term}
          >
            {c.term}
          </button>
        ))}
      </div>

      {/* Selected definition */}
      {active && (
        <div className="mt-2 rounded-lg bg-cream border border-border px-4 py-3">
          <p className="text-sm font-semibold text-ink">{active.term}</p>
          <p className="text-sm text-ink-secondary leading-relaxed mt-0.5">{active.definition}</p>
        </div>
      )}

      {/* Overflow concepts */}
      {overflow.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {overflow.map((c, i) => (
            <button
              key={c.term}
              data-anchor={anchor(section, `c${8 + i}`)}
              onClick={() => setSelected(8 + i)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                selected === 8 + i
                  ? 'bg-accent text-white border-accent'
                  : 'bg-accent-light text-accent-text border-transparent hover:border-accent/40'
              )}
            >
              {c.term}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
