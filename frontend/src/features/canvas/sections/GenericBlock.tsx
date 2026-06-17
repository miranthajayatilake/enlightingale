import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { anchor, type SectionProps } from './types'

/**
 * Safe fallback renderer for any block `type` without a dedicated component
 * (forward-compatibility for AI-composed kinds — see PRD v0.4 KD1). Renders the
 * title plus a best-effort view of common `data` shapes; never throws.
 */
export function GenericBlock({ section }: SectionProps) {
  const d = section.data ?? {}
  const text = [d.markdown, d.body, d.text, d.summary, d.essence].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  )
  const list = [d.items, d.points].find(
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'),
  )

  return (
    <div>
      <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-3">
        {section.title}
      </h2>
      {text && (
        <div className="text-ink-secondary leading-relaxed space-y-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
      {list && (
        <ul className="space-y-2">
          {list.map((item, i) => (
            <li key={i} data-anchor={anchor(section, `p${i}`)} className="flex gap-3 items-start">
              <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-sm text-ink-secondary leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
