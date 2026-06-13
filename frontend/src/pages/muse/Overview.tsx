import { useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { KnowledgeLayer, Muse, MuseCanvas } from '@/lib/api'
import { api } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { Canvas } from '@/features/canvas/Canvas'
import { CanvasSkeleton } from '@/features/canvas/CanvasSkeleton'

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
  // Guard: only act after canvas query has resolved (canvasLoaded) to avoid rebuilding a
  // perfectly good persisted canvas on cold load. Idempotent per Muse.
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

  // Auto-trigger KL build for Muses that pre-date v0.3 automation (idle KL, no Canvas).
  // New Muses have their KL enqueued by the backend on creation — this is only a fallback.
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
    return <Canvas muse={muse} canvas={canvas} rebuilding={klStatus === 'building'} />
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

  // ── Building (or idle — KL auto-trigger will fire momentarily) ───────────
  const message = klStatus === 'building' ? 'Building the knowledge layer…' : 'Composing your Canvas…'
  return (
    <div className="h-full overflow-y-auto">
      <CanvasSkeleton message={message} />
    </div>
  )
}
