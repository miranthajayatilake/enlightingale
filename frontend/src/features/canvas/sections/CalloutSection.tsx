import { cn } from '@/lib/utils'
import { anchor, data, type SectionProps } from './types'

interface CalloutData {
  tone?: 'info' | 'tip' | 'warning'
  body?: string
}

const TONE: Record<string, { box: string; icon: string }> = {
  info:    { box: 'bg-info/10 border-info/30', icon: 'ℹ️' },
  tip:     { box: 'bg-accent-light border-accent/30', icon: '✦' },
  warning: { box: 'bg-warning/10 border-warning/30', icon: '⚠️' },
}

export function CalloutSection({ section }: SectionProps) {
  const { tone = 'info', body } = data<CalloutData>(section)
  if (!body) return null
  const t = TONE[tone] ?? TONE.info

  return (
    <div>
      {section.title && (
        <p data-anchor={anchor(section, 't')} className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">
          {section.title}
        </p>
      )}
      <div className={cn('flex gap-3 rounded-lg border px-4 py-3.5', t.box)}>
        <span className="text-base leading-none mt-0.5 shrink-0">{t.icon}</span>
        <p data-anchor={anchor(section, 'p0')} className="text-sm text-ink leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  )
}
