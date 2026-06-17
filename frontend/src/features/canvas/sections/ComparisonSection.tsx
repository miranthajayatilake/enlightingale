import { anchor, data, type SectionProps } from './types'

interface ComparisonRow {
  label: string
  a: string
  b: string
}
interface ComparisonData {
  columns?: [string, string] | string[]
  rows?: ComparisonRow[]
}

export function ComparisonSection({ section }: SectionProps) {
  const { columns = ['', ''], rows = [] } = data<ComparisonData>(section)
  const [colA, colB] = columns

  return (
    <div>
      <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-4">{section.title}</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_1.5fr_1.5fr]">
          {/* header */}
          <div className="bg-cream-hover px-4 py-2.5 border-b border-border" />
          <div className="bg-cream-hover px-4 py-2.5 border-b border-l border-border text-sm font-semibold text-ink">
            {colA}
          </div>
          <div className="bg-cream-hover px-4 py-2.5 border-b border-l border-border text-sm font-semibold text-ink">
            {colB}
          </div>
          {/* rows */}
          {rows.map((r, i) => (
            <div key={i} className="contents">
              <div data-anchor={anchor(section, `r${i}`)} className="px-4 py-3 border-b border-border text-sm font-medium text-ink-secondary">
                {r.label}
              </div>
              <div data-anchor={anchor(section, `r${i}`)} className="px-4 py-3 border-b border-l border-border text-sm text-ink">{r.a}</div>
              <div data-anchor={anchor(section, `r${i}`)} className="px-4 py-3 border-b border-l border-border text-sm text-ink">{r.b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
