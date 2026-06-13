import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ChatSession, type Citation, type KnowledgeLayer, type Muse } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import type { DisplayMessage } from './ChatMessages'

let _msgCounter = 0
const tempId = () => `temp-${++_msgCounter}`

export function ChatPanel({ muse }: { muse: Muse }) {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const streamCleanupRef = useRef<(() => void) | null>(null)

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ChatSession[]>({
    queryKey: ['chat-sessions', muse.id],
    queryFn: () => api.get<ChatSession[]>(`/muses/${muse.id}/chat/sessions`),
  })

  useEffect(() => {
    if (!sessionId && sessions.length > 0) {
      setSessionId(sessions[0].id)
    }
  }, [sessions, sessionId])

  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: () => api.get<ChatSession>(`/muses/${muse.id}/chat/sessions/${sessionId}`),
    enabled: !!sessionId,
  })

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

  const { data: kl } = useQuery<KnowledgeLayer | null>({
    queryKey: ['knowledge', muse.id],
    queryFn: () => api.get<KnowledgeLayer | null>(`/muses/${muse.id}/knowledge`),
  })

  const createSession = useMutation({
    mutationFn: () => api.post<ChatSession>(`/muses/${muse.id}/chat/sessions`, {}),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', muse.id] })
      setSessionId(session.id)
      setDisplayMessages([])
    },
  })

  const deleteSession = useMutation({
    mutationFn: (id: string) => api.delete(`/muses/${muse.id}/chat/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions', muse.id] })
      setSessionId(null)
      setDisplayMessages([])
    },
  })

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isStreaming) return

      let sid = sessionId
      if (!sid) {
        const created = await createSession.mutateAsync()
        sid = created.id
      }

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
                    m.id === asstTempId ? { ...m, content: m.content + parsed.content! } : m
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

  useEffect(() => {
    return () => streamCleanupRef.current?.()
  }, [])

  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const handleSave = useCallback(
    async (msg: DisplayMessage) => {
      if (!msg.content || savedIds.has(msg.id) || savingId) return
      setSavingId(msg.id)
      // Derive a short title from the first line of the response
      const firstLine = msg.content.replace(/[#*_`]/g, '').split('\n')[0].trim()
      const title = firstLine.length > 80 ? firstLine.slice(0, 80).trimEnd() + '…' : firstLine
      try {
        await api.post(`/muses/${muse.id}/resources`, {
          source_type: 'text',
          title,
          content: msg.content,
        })
        setSavedIds((prev) => new Set([...prev, msg.id]))
        queryClient.invalidateQueries({ queryKey: ['resources', muse.id] })
        queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
        queryClient.invalidateQueries({ queryKey: ['muses'] })
      } catch {
        // silently fail — no permanent state was changed
      } finally {
        setSavingId(null)
      }
    },
    [muse.id, savingId, savedIds, queryClient]
  )

  const lastAssistantMsg = [...displayMessages].reverse().find((m) => m.role === 'assistant')
  const latestCitations = lastAssistantMsg?.citations ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Session bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-cream">
        {sessionsLoading ? (
          <Spinner size="sm" />
        ) : (
          <>
            {sessions.length > 0 && (
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSessionId(s.id); setDisplayMessages([]) }}
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
              {(!kl || kl.status !== 'ready') && (
                <span className="text-xs text-warning mr-2">⚠ No knowledge base yet</span>
              )}
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

      {/* Chat area */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 flex flex-col min-h-0">
          {!sessionId && !sessionsLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-3xl">💬</p>
              <p className="font-medium text-ink">Start a conversation</p>
              <p className="text-sm text-ink-secondary max-w-xs">
                Ask questions about {muse.name}. Answers are grounded in your knowledge base.
              </p>
              <Button onClick={() => createSession.mutate()} loading={createSession.isPending}>
                New Conversation
              </Button>
            </div>
          ) : (
            <ChatMessages
              messages={displayMessages}
              onSave={handleSave}
              savingId={savingId}
              savedIds={savedIds}
            />
          )}
          {sessionId && <ChatInput onSend={sendMessage} disabled={isStreaming} />}
        </div>

        {latestCitations.length > 0 && (
          <div className="w-56 shrink-0 border-l border-border bg-cream overflow-y-auto p-3">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Sources</p>
            <div className="space-y-2">
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
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <p className="text-xs font-medium text-ink leading-snug">{citation.resource_title}</p>
        {!expanded && (
          <p className="text-xs text-ink-muted mt-1 line-clamp-2">{citation.excerpt}</p>
        )}
      </button>
      {expanded && (
        <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
          {citation.excerpt}{citation.excerpt.length >= 200 && '…'}
        </p>
      )}
    </div>
  )
}
