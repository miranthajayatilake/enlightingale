import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { data, type SectionProps } from './types'

interface ProseData {
  markdown?: string
}

export function ProseSection({ section }: SectionProps) {
  const { markdown } = data<ProseData>(section)

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-3">{section.title}</h2>
      <div className="text-ink-secondary leading-relaxed space-y-3">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="leading-relaxed">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            h3: ({ children }) => <h3 className="font-semibold text-ink mt-4 mb-1">{children}</h3>,
            h4: ({ children }) => <h4 className="font-medium text-ink mt-3 mb-1">{children}</h4>,
          }}
        >
          {markdown ?? ''}
        </ReactMarkdown>
      </div>
    </div>
  )
}
