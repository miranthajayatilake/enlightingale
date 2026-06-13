import { useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { KnowledgeLayer, Muse, MuseCanvas } from '@/lib/api'
import { api } from '@/lib/api'
import { Button, Card, Spinner } from '@/design-system'
import { AgentStatusPanel } from '@/features/research-agent/AgentStatusPanel'
import { ResourceReviewList } from '@/features/research-agent/ResourceReviewList'
import { useAgentStatus } from '@/features/research-agent/useAgentStatus'
import { Canvas } from '@/features/canvas/Canvas'
import { CanvasSkeleton } from '@/features/canvas/CanvasSkeleton'

export function MuseOverview() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const queryClient = useQueryClient()

  const { data: kl, isLoading: klLoading } = useQuery<KnowledgeLayer | null>({
    queryKey: ['knowledge', muse.id],
    queryFn: () => api.get<KnowledgeLayer | null>(`/muses/${muse.id}/knowledge`),
    refetchInterval: (q) => ((q.state.data as KnowledgeLayer | null)?.status === 'building' ? 3000 : false),
  })

  const { data: canvas, isLoading: canvasLoading, isSuccess: canvasLoaded } = useQuery<MuseCanvas | null>({
    queryKey: ['canvas', muse.id],
    queryFn: () => api.get<MuseCanvas | null>(`/muses/${muse.id}/canvas`),
    refetchInterval: (q) => {
      const c = q.state.data as MuseCanvas | null
      const klBuilding = kl?.status === 'building'
      const klReadyNoCanvas = kl?.status === 'ready' && (!c || (c.status !== 'ready' && c.status !== 'failed'))
      return c?.status === 'building' || klBuilding || klReadyNoCanvas ? 3000 : false
    },
  })

  const buildCanvas = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/canvas/build`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] }),
  })

  // Auto-generate the Canvas once the Knowledge Layer is ready but no Canvas exists yet
  // (settled decision §13.3). Critical: only act AFTER the canvas query has resolved
  // (`canvasLoaded`) — otherwise on a cold page load `canvas` is still undefined and we'd
  // rebuild a perfectly good persisted canvas on every refresh. Idempotent per Muse.
  const triggeredFor = useRef<string | null>(null)
  useEffect(() => {
    if (!canvasLoaded) return
    const klReady = kl?.status === 'ready'
    const noCanvas = !canvas || canvas.status === 'idle'
    if (klReady && noCanvas && triggeredFor.current !== muse.id && !buildCanvas.isPending) {
      triggeredFor.current = muse.id
      buildCanvas.mutate()
    }
  }, [canvasLoaded, kl?.status, canvas, muse.id, buildCanvas])

  const klStatus = kl?.status ?? 'idle'
  const canvasStatus = canvas?.status ?? 'idle'

  // ── Loading (cold load — wait before deciding anything, never flash Setup) ────
  if (klLoading || canvasLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Ready ───────────────────────────────────────────────────────────────────
  if (canvas && canvasStatus === 'ready') {
    return <Canvas muse={muse} canvas={canvas} />
  }

  // ── Building ──────────────────────────────────────────────────────────────────
  if (canvasStatus === 'building' || klStatus === 'building' || (klStatus === 'ready' && canvasStatus === 'idle')) {
    const message = klStatus === 'building' ? 'Building the knowledge layer…' : 'Composing your overview…'
    return (
      <div className="h-full overflow-y-auto">
        <CanvasSkeleton message={message} />
      </div>
    )
  }

  // ── Failed ──────────────────────────────────────────────────────────────────
  if (canvasStatus === 'failed') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
        <p className="text-2xl">⚠️</p>
        <p className="font-semibold text-ink">Couldn't build the overview</p>
        <p className="text-sm text-ink-secondary max-w-sm">{canvas?.error ?? 'An error occurred.'}</p>
        <Button variant="secondary" onClick={() => buildCanvas.mutate()} loading={buildCanvas.isPending}>
          Try again
        </Button>
      </div>
    )
  }

  // ── Setup (no knowledge yet) ──────────────────────────────────────────────────
  return <SetupState muse={muse} kl={kl ?? null} />
}

// ── Setup state ─────────────────────────────────────────────────────────────────

function SetupState({ muse, kl }: { muse: Muse; kl: KnowledgeLayer | null }) {
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

  const buildKnowledge = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/knowledge/build`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] })
    },
  })

  const progress = latestEvent?.progress ?? (job?.progress ?? (muse.agent_status === 'complete' ? 100 : 0))
  const klStatus = kl?.status ?? 'idle'

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        {/* Research Agent */}
        <Card className="p-6">
          <h2 className="font-semibold text-ink mb-4">Research Agent</h2>

          {muse.agent_status === 'idle' && (
            <div className="flex items-end justify-between gap-6">
              <p className="text-sm text-ink-secondary leading-relaxed max-w-sm">
                The Research Agent scans the web, finds the best sources on this topic, and builds a curated
                reading list ready for your review.
              </p>
              <Button onClick={() => runAgent.mutate()} loading={runAgent.isPending} className="shrink-0">
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
              <Button variant="secondary" onClick={() => runAgent.mutate()} loading={runAgent.isPending} className="shrink-0">
                Retry
              </Button>
            </div>
          )}
        </Card>

        {/* Knowledge Layer build — the gateway to the Canvas */}
        {muse.resource_count > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold text-ink mb-2">Knowledge Layer</h2>
            {klStatus === 'failed' ? (
              <div className="flex items-end justify-between gap-6">
                <p className="text-sm text-error">
                  Build failed. <span className="text-ink-muted">{kl?.error ?? 'Unknown error.'}</span>
                </p>
                <Button variant="secondary" onClick={() => buildKnowledge.mutate()} loading={buildKnowledge.isPending} className="shrink-0">
                  Retry
                </Button>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-6">
                <p className="text-sm text-ink-secondary leading-relaxed max-w-sm">
                  Build the knowledge layer from your approved resources. Once it's ready, your visual
                  overview is composed automatically.
                </p>
                <Button onClick={() => buildKnowledge.mutate()} loading={buildKnowledge.isPending} className="shrink-0">
                  Build Knowledge Layer
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* About this Muse */}
        <Card className="p-6">
          <h2 className="font-semibold text-ink mb-2">What you want to understand</h2>
          <p className="text-ink-secondary text-sm leading-relaxed">{muse.description}</p>
        </Card>
      </div>
    </div>
  )
}
