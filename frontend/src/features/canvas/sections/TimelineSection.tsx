import { data, type SectionProps } from './types'

interface TimelineEvent {
  when: string
  label: string
  detail?: string
}
interface TimelineData {
  events?: TimelineEvent[]
}

export function TimelineSection({ section }: SectionProps) {
  const { events = [] } = data<TimelineData>(section)

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-5">{section.title}</h2>
      <div className="relative pl-6">
        {/* vertical line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
        <div className="space-y-6">
          {events.map((e, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-accent border-2 border-surface" />
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">{e.when}</p>
              <p className="text-sm font-medium text-ink mt-0.5">{e.label}</p>
              {e.detail && (
                <p className="text-sm text-ink-secondary leading-relaxed mt-0.5">{e.detail}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
