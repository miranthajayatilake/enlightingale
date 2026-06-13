import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ChatSession, type Citation, type KnowledgeLayer, type Muse } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { ChatMessages } from '@/features/chat/ChatMessages'
import { ChatInput } from '@/features/chat/ChatInput'
import type { DisplayMessage } from '@/features/chat/ChatMessages'

let _msgCounter = 0
const tempId = () => `temp-${++_msgCounter}`

export function Chat() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const queryClient = useQueryClient()

  // Active session
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Streaming state
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const streamCleanupRef = useRef<(() => void) | null>(null)

  // ── Sessions list ────────────────────────────────────────────────────────
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ChatSession[]>({
    queryKey: ['chat-sessions', muse.id],
    queryFn: () => api.get<ChatSession[]>(`/muses/${muse.id}/chat/sessions`),
  })

  // Auto-select the most recent session when sessions load
  useEffect(() => {
    if (!sessionId && sessions.length > 0) {
      setSessionId(sessions[0].id)
    }
  }, [sessions, sessionId])

  // ── Active session messages ──────────────────────────────────────────────
  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: () => api.get<ChatSession>(`/muses/${muse.id}/chat/sessions/${sessionId}`),
    enabled: !!sessionId,
  })

  // Sync display messages from server (when not streaming)
  useEffect(() => {
    if (!sessionData?.messages || isStreaming) return
    setDisplayMessages(
      (sessionData.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations ?? [],
      }))
    )
  }, [sessionData?.messages, isStreaming])

  // ── Knowledge layer check (for warning) ─────────────────────────────────
  const { data: kl } = useQuery<KnowledgeLayer | null>({
    queryKey: ['knowledge', muse.id],
    queryFn: () => api.get<KnowledgeLayer | null>(`/muses/${muse.id}/knowledge`),
  })

  // ── Create session ───────────────────────────────────────────────────────
  const createSession = useMutation({
    mutationFn: () => api.post<ChatSession>(`/muses/${muse.id}/chat/sessions`, {}),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', muse.id] })
      setSessionId(session.id)
      setDisplayMessages([])
    },
  })

  // ── Delete session ───────────────────────────────────────────────────────
  const deleteSession = useMutation({
    mutationFn: (id: string) => api.delete(`/muses/${muse.id}/chat/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', muse.id] })
      setSessionId(null)
      setDisplayMessages([])
    },
  })

  // ── Send message + stream response ──────────────────────────────────────
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isStreaming) return

      // Ensure we have a session
      let sid = sessionId
      if (!sid) {
        const created = await createSession.mutateAsync()
        sid = created.id
      }

      // Append optimistic user + empty streaming assistant messages
      const userTempId = tempId()
      const asstTempId = tempId()
      setDisplayMessages((prev) => [
        ...prev,
        { id: userTempId, role: 'user', content: input, citations: [] },
        { id: asstTempId, role: 'assistant', content: '', citations: [], isStreaming: true },
      ])

      setIsStreaming(true)

      let buffer = ''

      const onStreamError = (err: Error) => {
        setDisplayMessages((prev) =>
          prev.map((m) =>
            m.id === asstTempId
              ? { ...m, content: `Something went wrong. Please try again. (${err.message})`, isStreaming: false }
              : m
          )
        )
        setIsStreaming(false)
      }

      const cleanup = api.stream(
        `/muses/${muse.id}/chat/sessions/${sid}/message`,
        { content: input },
        (rawChunk) => {
          buffer += rawChunk
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const event of events) {
            const dataLine = event.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            const data = dataLine.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data) as {
                type: string
                content?: string
                citations?: Citation[]
                message?: string
              }

              if (parsed.type === 'text' && parsed.content) {
                setDisplayMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstTempId
                      ? { ...m, content: m.content + parsed.content! }
                      : m
                  )
                )
              } else if (parsed.type === 'done') {
                setDisplayMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstTempId
                      ? { ...m, citations: parsed.citations ?? [], isStreaming: false }
                      : m
                  )
                )
              } else if (parsed.type === 'error') {
                setDisplayMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstTempId
                      ? { ...m, content: `Something went wrong: ${parsed.message ?? 'Unknown error'}`, isStreaming: false }
                      : m
                  )
                )
              }
            } catch {
              // malformed chunk, skip
            }
          }
        },
        () => {
          setIsStreaming(false)
          refetchSession().then(() => {
            queryClient.invalidateQueries({ queryKey: ['chat-sessions', muse.id] })
          })
        },
        onStreamError
      )

      streamCleanupRef.current = cleanup
    },
    [sessionId, isStreaming, muse.id, createSession, refetchSession, queryClient]
  )

  // Cleanup stream on unmount
  useEffect(() => {
    return () => streamCleanupRef.current?.()
  }, [])

  // ── Latest citations (from last assistant message) ───────────────────────
  const lastAssistantMsg = [...displayMessages].reverse().find((m) => m.role === 'assistant')
  const latestCitations = lastAssistantMsg?.citations ?? []

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Session bar */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-border bg-cream">
        {sessionsLoading ? (
          <Spinner size="sm" />
        ) : (
          <>
            {/* Session selector */}
            {sessions.length > 0 && (
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSessionId(s.id)
                      setDisplayMessages([])
                    }}
                    className={[
                      'shrink-0 px-3 py-1.5 rounded-md text-xs transition-colors',
                      s.id === sessionId
                        ? 'bg-accent text-white font-medium'
                        : 'text-ink-muted hover:bg-cream-hover hover:text-ink',
                    ].join(' ')}
                  >
                    {s.title ?? 'New conversation'}
                  </button>
                ))}
              </div>
            )}

            <div className="shrink-0 flex items-center gap-1 ml-auto">
              {/* No knowledge layer warning */}
              {(!kl || kl.status !== 'ready') && (
                <span className="text-xs text-warning mr-2">⚠ No knowledge base built</span>
              )}

              {/* Delete current session */}
              {sessionId && (
                <button
                  onClick={() => deleteSession.mutate(sessionId)}
                  disabled={deleteSession.isPending}
                  className="p-1.5 text-ink-muted hover:text-error transition-colors disabled:opacity-40 rounded"
                  title="Delete this conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 3.5h10M5.5 3.5V2.5h3v1M4 3.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              {/* New conversation */}
              <Button
                variant="secondary"
                onClick={() => createSession.mutate()}
                loading={createSession.isPending}
                className="h-8 px-3 text-xs"
              >
                + New
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-h-0 flex">
        {/* Messages + input */}
        <div className="flex-1 flex flex-col min-h-0">
          {!sessionId && !sessionsLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-3xl">💬</p>
              <p className="font-medium text-ink">Start a conversation</p>
              <p className="text-sm text-ink-secondary max-w-xs">
                Ask questions about {muse.name}. Your answers are grounded in your knowledge base.
              </p>
              <Button onClick={() => createSession.mutate()} loading={createSession.isPending}>
                New Conversation
              </Button>
            </div>
          ) : (
            <ChatMessages messages={displayMessages} />
          )}

          {sessionId && (
            <ChatInput onSend={sendMessage} disabled={isStreaming} />
          )}
        </div>

        {/* Sources panel */}
        {latestCitations.length > 0 && (
          <div className="w-64 shrink-0 border-l border-border bg-cream overflow-y-auto p-4">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Sources
            </p>
            <div className="space-y-3">
              {latestCitations.map((cite) => (
                <SourceCard key={cite.resource_id} citation={cite} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SourceCard({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
      >
        <p className="text-xs font-medium text-ink leading-snug">{citation.resource_title}</p>
        {!expanded && (
          <p className="text-xs text-ink-muted mt-1 line-clamp-2">{citation.excerpt}</p>
        )}
      </button>
      {expanded && (
        <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{citation.excerpt}{citation.excerpt.length >= 200 && '…'}</p>
      )}
    </div>
  )
}
