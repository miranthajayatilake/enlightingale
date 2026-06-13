import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Muse, type Resource } from '@/lib/api'
import { Badge, Button, Card, Input, Spinner } from '@/design-system'
import { AddResourceModal } from '@/features/resources/AddResourceModal'
import { AgentStatusPanel } from '@/features/research-agent/AgentStatusPanel'
import { ResourceReviewList } from '@/features/research-agent/ResourceReviewList'
import { useAgentStatus } from '@/features/research-agent/useAgentStatus'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { relativeTime } from '@/lib/utils'

const TYPE_ICON: Record<string, string> = {
  url:   '🔗',
  pdf:   '📄',
  text:  '📝',
  agent: '🤖',
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  pending:    { label: 'Queued',     variant: 'warning' },
  processing: { label: 'Processing', variant: 'warning' },
  ready:      { label: 'Ready',      variant: 'success' },
  failed:     { label: 'Failed',     variant: 'error' },
}

export function Research() {
  const { muse } = useOutletContext<{ muse: Muse }>()

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink">Research</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Send the Research Agent, manage your sources, or ask a question.
          </p>
        </div>
        <div className="space-y-10">
          <ResearchAgentSection muse={muse} />
          <SourcesSection muse={muse} />
          <ChatSection muse={muse} />
        </div>
      </div>
    </div>
  )
}

// ── Research Agent ────────────────────────────────────────────────────────────

function ResearchAgentSection({ muse }: { muse: Muse }) {
  const queryClient = useQueryClient()
  const [focus, setFocus] = useState('')
  const { latestEvent, subtopics, searching, job } = useAgentStatus(muse.id, muse.agent_status)

  const { data: agentResults } = useQuery({
    queryKey: ['agent-results', muse.id],
    queryFn: () =>
      api.get<{ report: { coverage_summary: string; gaps: string[] } | null }>(`/muses/${muse.id}/agent/results`),
    enabled: muse.agent_status === 'complete',
  })

  const runAgent = useMutation({
    mutationFn: (focusText: string) =>
      api.post(`/muses/${muse.id}/agent/run`, focusText.trim() ? { focus: focusText.trim() } : {}),
    onSuccess: () => {
      setFocus('')
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
      queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['knowledge', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['agent-results', muse.id] })
    },
  })

  const progress = latestEvent?.progress ?? (job?.progress ?? (muse.agent_status === 'complete' ? 100 : 0))
  const isRunning = muse.agent_status === 'running'

  return (
    <div>
      {/* Top action bar — always shown unless agent is running */}
      {!isRunning && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <Input
                placeholder="What should the agent focus on? (optional — leave blank to use the Muse's focus)"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runAgent.mutate(focus) } }}
                disabled={runAgent.isPending}
              />
            </div>
            <Button
              onClick={() => runAgent.mutate(focus)}
              loading={runAgent.isPending}
              className="shrink-0"
            >
              {muse.agent_status === 'complete' ? 'Run another pass' : 'Run a research pass'}
            </Button>
          </div>
          {runAgent.isError && (
            <p className="text-xs text-error mt-2">Couldn't start the Research Agent. Please try again.</p>
          )}
        </Card>
      )}

      {/* Running — full progress panel */}
      {isRunning && (
        <Card className="p-6 mb-6">
          <AgentStatusPanel
            museeName={muse.name}
            latestEvent={latestEvent}
            subtopics={subtopics}
            searching={searching}
            progress={progress}
          />
        </Card>
      )}

      {/* Complete — review list */}
      {muse.agent_status === 'complete' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Sources to review</h2>
              <p className="text-sm text-ink-muted mt-0.5">
                Approve sources to add them to your knowledge base.
              </p>
            </div>
          </div>
          <ResourceReviewList
            museId={muse.id}
            coverageSummary={agentResults?.report?.coverage_summary}
            gaps={agentResults?.report?.gaps}
          />
        </div>
      )}

      {/* Failed */}
      {muse.agent_status === 'failed' && (
        <p className="text-sm text-error mb-6">
          The Research Agent encountered an error.{' '}
          <span className="text-ink-muted">Retry above or add sources manually below.</span>
        </p>
      )}
    </div>
  )
}

// ── Sources ───────────────────────────────────────────────────────────────────

function SourcesSection({ muse }: { muse: Muse }) {
  const [showModal, setShowModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: allResources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ['resources', muse.id],
    queryFn: () => api.get<Resource[]>(`/muses/${muse.id}/resources`),
    refetchInterval: (query) => {
      const data = query.state.data as Resource[] | undefined
      const busy = data?.some((r) => r.status === 'pending' || r.status === 'processing')
      return busy ? 3000 : false
    },
  })

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id)
      return api.delete(`/muses/${muse.id}/resources/${id}`)
    },
    onSettled: () => setDeletingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
    },
  })

  const resources = allResources.filter((r) => r.origin === 'user' || r.approved)
  const processing = resources.filter((r) => r.status === 'pending' || r.status === 'processing')
  const ready = resources.filter((r) => r.status === 'ready')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Sources</h2>
          {resources.length > 0 && (
            <p className="text-sm text-ink-muted mt-0.5">
              {ready.length} ready{processing.length > 0 && ` · ${processing.length} processing`}
            </p>
          )}
        </div>
        <Button onClick={() => setShowModal(true)}>+ Add Source</Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && resources.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <p className="text-3xl mb-3">📚</p>
          <p className="font-medium text-ink mb-1">No sources yet</p>
          <p className="text-sm text-ink-muted max-w-xs mx-auto mb-4">
            Add URLs, PDFs, or notes — or use the Research Agent above to find sources automatically.
            Agent-gathered sources appear here after you approve them.
          </p>
          <Button variant="secondary" onClick={() => setShowModal(true)}>Add a source</Button>
        </div>
      )}

      {resources.length > 0 && (
        <div className="space-y-3">
          {resources.map((resource) => (
            <SourceRow
              key={resource.id}
              resource={resource}
              onDelete={() => deleteResource.mutate(resource.id)}
              deleting={deletingId === resource.id}
            />
          ))}
        </div>
      )}

      <AddResourceModal museId={muse.id} open={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}

function SourceRow({
  resource,
  onDelete,
  deleting,
}: {
  resource: Resource
  onDelete: () => void
  deleting: boolean
}) {
  const isProcessing = resource.status === 'pending' || resource.status === 'processing'
  const badge = STATUS_BADGE[resource.status] ?? { label: resource.status, variant: 'default' as const }

  const hostname = resource.source_url
    ? (() => { try { return new URL(resource.source_url).hostname } catch { return null } })()
    : null

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[resource.source_type] ?? '📄'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <p className="font-medium text-ink text-sm leading-snug">{resource.title}</p>
              {hostname && <p className="text-xs text-ink-muted mt-0.5">{hostname}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isProcessing && <Spinner size="sm" />}
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </div>

          {resource.summary && (
            <p className="text-sm text-ink-secondary leading-relaxed mt-2">{resource.summary}</p>
          )}

          {isProcessing && !resource.summary && (
            <div className="mt-2 space-y-1.5">
              {[75, 95, 55].map((w, i) => (
                <div key={i} className="h-3 bg-border rounded animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
            <span className="text-xs text-ink-muted">{relativeTime(resource.created_at)}</span>
            {resource.source_url && (
              <a href={resource.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-ink-muted hover:text-accent">
                Open ↗
              </a>
            )}
            <button onClick={onDelete} disabled={deleting}
              className="ml-auto text-xs text-ink-muted hover:text-error disabled:opacity-50 transition-colors">
              Remove
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function ChatSection({ muse }: { muse: Muse }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Ask a question</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          Chat with your knowledge base. Useful answers can be saved as sources.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden h-[520px]">
        <ChatPanel muse={muse} />
      </div>
    </div>
  )
}
