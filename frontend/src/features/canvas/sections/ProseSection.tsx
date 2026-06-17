import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { anchor, data, type SectionProps } from './types'

interface ProseData {
  markdown?: string
}

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="leading-relaxed">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="font-semibold text-ink mt-4 mb-1">{children}</h3>,
  h4: ({ children }: { children?: React.ReactNode }) => <h4 className="font-medium text-ink mt-3 mb-1">{children}</h4>,
}

export function ProseSection({ section }: SectionProps) {
  const { markdown } = data<ProseData>(section)
  // Split mirrors the backend anchor scheme: paragraphs by blank line → `.p{i}`.
  const paragraphs = (markdown ?? '').split('\n\n').filter((p) => p.trim())

  return (
    <div>
      <h2 data-anchor={anchor(section, 't')} className="text-lg font-semibold text-ink mb-3">
        {section.title}
      </h2>
      <div className="text-ink-secondary leading-relaxed space-y-3">
        {paragraphs.map((para, i) => (
          <div key={i} data-anchor={anchor(section, `p${i}`)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {para}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  )
}
