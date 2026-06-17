import { anchor, data, type SectionProps } from './types'

interface TakeawaysData {
  points?: string[]
}

export function TakeawaysSection({ section }: SectionProps) {
  const { points = [] } = data<TakeawaysData>(section)

  return (
    <div>
      <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-4">{section.title}</h2>
      <ol className="space-y-3">
        {points.map((point, i) => (
          <li key={i} data-anchor={anchor(section, `p${i}`)} className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-ink leading-relaxed pt-0.5">{point}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
