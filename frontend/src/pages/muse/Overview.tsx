import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Muse } from '@/lib/api'
import { api } from '@/lib/api'
import { Button, Card } from '@/design-system'
import { AgentStatusPanel } from '@/features/research-agent/AgentStatusPanel'
import { ResourceReviewList } from '@/features/research-agent/ResourceReviewList'
import { useAgentStatus } from '@/features/research-agent/useAgentStatus'
import { KnowledgeLayerPanel } from '@/features/knowledge/KnowledgeLayerPanel'

export function MuseOverview() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const queryClient = useQueryClient()
  const { latestEvent, subtopics, searching, job } = useAgentStatus(
    muse.id,
    muse.agent_status,
  )

  const { data: agentResults } = useQuery({
    queryKey: ['agent-results', muse.id],
    queryFn: () => api.get<{ report: { coverage_summary: string; gaps: string[] } | null }>(`/muses/${muse.id}/agent/results`),
    enabled: muse.agent_status === 'complete',
  })

  const runAgent = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/agent/run`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
    },
  })

  const progress =
    latestEvent?.progress ??
    (job?.progress ?? (muse.agent_status === 'complete' ? 100 : 0))

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* ── Research Agent ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h2 className="font-semibold text-ink mb-4">Research Agent</h2>

        {muse.agent_status === 'idle' && (
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-sm text-ink-secondary leading-relaxed max-w-sm">
                The Research Agent scans the web, finds the best sources on this topic,
                and builds a curated reading list ready for your review.
              </p>
            </div>
            <Button
              onClick={() => runAgent.mutate()}
              loading={runAgent.isPending}
              className="shrink-0"
            >
              Run Research Agent
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
                {runAgent.isPending ? 'Starting…' : 'Run again'}
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
              <span className="text-ink-muted">You can retry or add resources manually.</span>
            </p>
            <Button
              variant="secondary"
              onClick={() => runAgent.mutate()}
              loading={runAgent.isPending}
              className="shrink-0"
            >
              Retry
            </Button>
          </div>
        )}
      </Card>

      {/* ── Knowledge Layer ────────────────────────────────────────────── */}
      {muse.resource_count > 0 && (
        <KnowledgeLayerPanel museId={muse.id} resourceCount={muse.resource_count} />
      )}

      {/* ── About this Muse ────────────────────────────────────────────── */}
      <Card className="p-6">
        <h2 className="font-semibold text-ink mb-2">What you want to understand</h2>
        <p className="text-ink-secondary text-sm leading-relaxed">{muse.description}</p>
      </Card>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Resources', value: muse.resource_count },
          { label: 'Knowledge level', value: muse.knowledge_level },
          { label: 'Status', value: muse.status },
        ].map(({ label, value }) => (
          <Card key={label} className="p-4 text-center">
            <p className="text-xl font-semibold text-ink capitalize">{value}</p>
            <p className="text-ink-muted text-xs mt-1">{label}</p>
          </Card>
        ))}
      </div>
    </div>
    </div>
  )
}
