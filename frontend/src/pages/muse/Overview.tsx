import { useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { KnowledgeLayer, Muse, MuseCanvas, Resource } from '@/lib/api'
import { api } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { Canvas } from '@/features/canvas/Canvas'
import { CanvasBuildStages } from '@/features/canvas/CanvasBuildStages'

export function MuseOverview() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const queryClient = useQueryClient()

  const { data: kl, isLoading: klLoading, isSuccess: klLoaded } = useQuery<KnowledgeLayer | null>({
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

  // Poll resources while anything is building, to drive the "Reading sources" stage.
  const isBuilding = kl?.status === 'building' || canvas?.status === 'building'
    || (!kl || kl.status === 'idle') || (kl?.status === 'ready' && (!canvas || canvas.status !== 'ready' && canvas.status !== 'failed'))
  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ['resources', muse.id],
    queryFn: () => api.get<Resource[]>(`/muses/${muse.id}/resources`),
    enabled: isBuilding,
    refetchInterval: isBuilding ? 3000 : false,
  })

  const hasProcessingResources = resources.some(
    (r) => r.status === 'pending' || r.status === 'processing'
  )

  const buildCanvas = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/canvas/build`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] }),
  })

  const buildKl = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/knowledge/build`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] })
    },
  })

  // Auto-generate the Canvas once the Knowledge Layer is ready but no Canvas exists yet.
  const canvasTriggeredFor = useRef<string | null>(null)
  useEffect(() => {
    if (!canvasLoaded) return
    const klReady = kl?.status === 'ready'
    const noCanvas = !canvas || canvas.status === 'idle'
    if (klReady && noCanvas && canvasTriggeredFor.current !== muse.id && !buildCanvas.isPending) {
      canvasTriggeredFor.current = muse.id
      buildCanvas.mutate()
    }
  }, [canvasLoaded, kl?.status, canvas, muse.id, buildCanvas])

  // Fallback: auto-trigger KL for pre-v0.3 Muses that have an idle KL with no Canvas.
  const klTriggeredFor = useRef<string | null>(null)
  useEffect(() => {
    if (!klLoaded || !canvasLoaded) return
    const klIdle = !kl || kl.status === 'idle'
    const canvasNotReady = !canvas || canvas.status !== 'ready'
    if (klIdle && canvasNotReady && klTriggeredFor.current !== muse.id && !buildKl.isPending) {
      klTriggeredFor.current = muse.id
      buildKl.mutate()
    }
  }, [klLoaded, canvasLoaded, kl?.status, canvas?.status, muse.id, buildKl])

  const klStatus = kl?.status ?? 'idle'
  const canvasStatus = canvas?.status ?? 'idle'

  // ── Loading (cold load) ──────────────────────────────────────────────────
  if (klLoading || canvasLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Ready ────────────────────────────────────────────────────────────────
  if (canvas && canvasStatus === 'ready') {
    return <Canvas muse={muse} canvas={canvas} />
  }

  // ── KL failed ────────────────────────────────────────────────────────────
  if (klStatus === 'failed') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
        <p className="text-2xl">⚠️</p>
        <p className="font-semibold text-ink">Couldn't build the knowledge layer</p>
        <p className="text-sm text-ink-secondary max-w-sm">{kl?.error ?? 'An error occurred.'}</p>
        <Button variant="secondary" onClick={() => buildKl.mutate()} loading={buildKl.isPending}>
          Try again
        </Button>
      </div>
    )
  }

  // ── Canvas failed ─────────────────────────────────────────────────────────
  if (canvasStatus === 'failed') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
        <p className="text-2xl">⚠️</p>
        <p className="font-semibold text-ink">Couldn't build the Canvas</p>
        <p className="text-sm text-ink-secondary max-w-sm">{canvas?.error ?? 'An error occurred.'}</p>
        <Button variant="secondary" onClick={() => buildCanvas.mutate()} loading={buildCanvas.isPending}>
          Try again
        </Button>
      </div>
    )
  }

  // ── Building (or idle → KL auto-trigger will fire momentarily) ───────────
  return (
    <div className="h-full overflow-y-auto">
      <CanvasBuildStages
        muse={muse}
        klStatus={klStatus}
        canvasStatus={canvasStatus}
        hasProcessingResources={hasProcessingResources}
      />
    </div>
  )
}
