import { anchor, data, type SectionProps } from './types'

interface PullQuoteData {
  quote?: string
  attribution?: string | null
}

export function PullQuoteSection({ section }: SectionProps) {
  const { quote, attribution } = data<PullQuoteData>(section)
  if (!quote) return null

  return (
    <figure className="py-2">
      {section.title && (
        <figcaption
          data-anchor={anchor(section, 't')}
          className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3"
        >
          {section.title}
        </figcaption>
      )}
      <blockquote
        data-anchor={anchor(section, 'p0')}
        className="border-l-2 border-accent pl-5 text-xl text-ink italic leading-relaxed"
      >
        {quote}
      </blockquote>
      {attribution && (
        <p className="mt-3 pl-5 text-sm text-ink-muted">— {attribution}</p>
      )}
    </figure>
  )
}
