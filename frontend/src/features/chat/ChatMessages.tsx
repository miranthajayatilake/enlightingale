import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Citation, ChatMessage as ChatMessageType } from '@/lib/api'
import { Spinner } from '@/design-system'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  isStreaming?: boolean
}

interface Props {
  messages: DisplayMessage[]
  onSave?: (msg: DisplayMessage) => void
  savingId?: string | null
  savedIds?: Set<string>
}

export function ChatMessages({ messages, onSave, savingId, savedIds }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.content.length])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <p className="text-3xl">💬</p>
        <p className="font-medium text-ink">Ask anything</p>
        <p className="text-sm text-ink-secondary max-w-xs">
          Your questions are answered using your Muse's knowledge base, with sources cited.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onSave={onSave}
          saving={savingId === msg.id}
          saved={savedIds?.has(msg.id) ?? false}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({
  message,
  onSave,
  saving,
  saved,
}: {
  message: DisplayMessage
  onSave?: (msg: DisplayMessage) => void
  saving: boolean
  saved: boolean
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] px-4 py-3 bg-accent text-white rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 max-w-[88%]">
      <div className="px-5 py-4 bg-surface border border-border rounded-2xl rounded-tl-sm shadow-sm">
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-2 text-ink-muted text-sm">
            <Spinner size="sm" />
            <span>Thinking…</span>
          </div>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="text-sm text-ink leading-relaxed mb-3 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc list-outside ml-4 text-sm text-ink space-y-1 mb-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-outside ml-4 text-sm text-ink space-y-1 mb-3">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                pre: ({ children }) => (
                  <pre className="my-3 rounded-lg bg-cream-muted border border-border overflow-x-auto p-4">
                    {children}
                  </pre>
                ),
                code: ({ children, className }) => {
                  const isBlock = !!className
                  if (isBlock) {
                    return <code className="text-xs font-mono text-ink-secondary block whitespace-pre">{children}</code>
                  }
                  return <code className="px-1 py-0.5 bg-cream text-ink-secondary rounded text-xs font-mono">{children}</code>
                },
                blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 text-ink-secondary italic text-sm">{children}</blockquote>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse" />
            )}
          </div>
        )}
      </div>

      {!message.isStreaming && (
        <div className="flex items-start gap-2 pl-1 flex-wrap">
          {message.citations.length > 0 && (
            <div className="flex-1 min-w-0">
              <CitationChips citations={message.citations} />
            </div>
          )}
          {onSave && message.content && (
            <button
              onClick={() => onSave(message)}
              disabled={saving || saved}
              className="shrink-0 text-xs text-ink-muted hover:text-accent disabled:opacity-50 transition-colors ml-auto"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save to resources'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function CitationChips({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap gap-1.5 pl-1">
      {citations.map((cite) => (
        <div key={cite.resource_id}>
          <button
            onClick={() => setExpanded(expanded === cite.resource_id ? null : cite.resource_id)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-cream border border-border rounded-full text-xs text-ink-secondary hover:border-accent hover:text-accent transition-colors"
          >
            <span className="text-[10px]">📄</span>
            <span className="max-w-[160px] truncate">{cite.resource_title}</span>
          </button>
          {expanded === cite.resource_id && (
            <div className="mt-1.5 p-3 bg-cream border border-border rounded-lg text-xs text-ink-secondary leading-relaxed max-w-xs">
              {cite.excerpt}
              {cite.excerpt.length >= 200 && '…'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Re-export type so Chat.tsx can use it
export type { DisplayMessage }
export type { ChatMessageType }
