import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Muse, type Resource } from '@/lib/api'
import { Badge, Button, Card, Spinner } from '@/design-system'
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
      <div className="p-8 max-w-3xl mx-auto space-y-10">
        <ResearchAgentSection muse={muse} />
        <SourcesSection muse={muse} />
        <ChatSection muse={muse} />
      </div>
    </div>
  )
}

// ── Research Agent ────────────────────────────────────────────────────────────

function ResearchAgentSection({ muse }: { muse: Muse }) {
  const queryClient = useQueryClient()
  const { latestEvent, subtopics, searching, job } = useAgentStatus(muse.id, muse.agent_status)

  const { data: agentResults } = useQuery({
    queryKey: ['agent-results', muse.id],
    queryFn: () =>
      api.get<{ report: { coverage_summary: string; gaps: string[] } | null }>(`/muses/${muse.id}/agent/results`),
    enabled: muse.agent_status === 'complete',
  })

  const runAgent = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/agent/run`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
    },
  })

  const progress = latestEvent?.progress ?? (job?.progress ?? (muse.agent_status === 'complete' ? 100 : 0))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Research Agent</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            Scans the web, finds strong sources, and brings them back for your review.
          </p>
        </div>
      </div>

      <Card className="p-6">
        {muse.agent_status === 'idle' && (
          <div className="flex items-end justify-between gap-6">
            <p className="text-sm text-ink-secondary leading-relaxed max-w-sm">
              Send the Research Agent to dig deeper into <strong>{muse.name}</strong>. It builds on
              whatever is already here and brings back a curated batch for your review.
            </p>
            <Button onClick={() => runAgent.mutate()} loading={runAgent.isPending} className="shrink-0">
              Run a research pass
            </Button>
          </div>
        )}

        {muse.agent_status === 'running' && (
          <AgentStatusPanel
            museeName={muse.name}
            latestEvent={latestEvent}
            subtopics={subtopics}
            searching={searching}
            progress={progress}
          />
        )}

        {muse.agent_status === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-muted font-medium uppercase tracking-wide">
                Sources ready for review
              </p>
              <button
                onClick={() => runAgent.mutate()}
                disabled={runAgent.isPending}
                className="text-xs text-ink-muted hover:text-accent disabled:opacity-50 transition-colors"
              >
                {runAgent.isPending ? 'Starting…' : 'Run another pass'}
              </button>
            </div>
            <ResourceReviewList
              museId={muse.id}
              coverageSummary={agentResults?.report?.coverage_summary}
              gaps={agentResults?.report?.gaps}
            />
          </div>
        )}

        {muse.agent_status === 'failed' && (
          <div className="flex items-end justify-between gap-6">
            <p className="text-sm text-error">
              The Research Agent encountered an error.{' '}
              <span className="text-ink-muted">You can retry or add resources manually below.</span>
            </p>
            <Button variant="secondary" onClick={() => runAgent.mutate()} loading={runAgent.isPending} className="shrink-0">
              Retry
            </Button>
          </div>
        )}
      </Card>
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

  const deleteResource = useMutation({
    mutationFn: (id: string) => api.delete(`/muses/${muse.id}/resources/${id}`),
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
              deleting={deleteResource.isPending}
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
      <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden" style={{ height: 520 }}>
        <ChatPanel muse={muse} />
      </div>
    </div>
  )
}
