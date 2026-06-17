import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Muse, type MuseCanvas } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { useTourStore } from './tourStore'
import { useMentorPaneStore } from '@/features/voice/mentorPaneStore'
import { BlockRenderer } from './BlockRenderer'
import { ExplainPopup } from './ExplainPopup'
import { useAnchorTarget } from './useAnchorTarget'
import { cn } from '@/lib/utils'

const DENSITY_GAP: Record<string, string> = {
  airy: 'space-y-6',
  balanced: 'space-y-2',
  dense: 'space-y-0.5',
}

interface Props {
  muse: Muse
  canvas: MuseCanvas
}

export function Canvas({ muse, canvas }: Props) {
  const sections = [...canvas.sections].sort((a, b) => a.order - b.order)
  const activeAnchorIds = useTourStore((s) => s.activeAnchorIds)
  const tourPhase = useTourStore((s) => s.tourPhase)
  const requestExplain = useTourStore((s) => s.requestExplain)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Dynamic "Explain this": resolve a click/selection to the nearest anchor and offer it.
  const { target: explainTarget, clear: clearExplain } = useAnchorTarget(containerRef)

  // Distinguish our own programmatic scrolls from the user's, so we can respect manual scroll.
  const lastManualScrollRef = useRef(0)
  const autoScrollingRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      if (!autoScrollingRef.current) lastManualScrollRef.current = Date.now()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // During a Guided Tour, outline the anchored element(s) the Mentor is narrating and scroll
  // the most specific one into view — unless the user scrolled manually in the last few
  // seconds (don't fight them). A bare block id is shown via the block's active shell, so we
  // only outline sub-element anchors here.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.querySelectorAll('.canvas-anchor-active').forEach((n) => n.classList.remove('canvas-anchor-active'))
    if (activeAnchorIds.length === 0) return

    const subAnchors = activeAnchorIds.filter((a) => a.includes('.'))
    subAnchors.forEach((a) => {
      el.querySelectorAll(`[data-anchor="${CSS.escape(a)}"]`).forEach((n) => n.classList.add('canvas-anchor-active'))
    })

    if (Date.now() - lastManualScrollRef.current < 4000) return
    const targetId = subAnchors[0] ?? activeAnchorIds[0]
    const target = el.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(targetId)}"]`)
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    autoScrollingRef.current = true
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    const timer = window.setTimeout(() => { autoScrollingRef.current = false }, 1000)
    return () => window.clearTimeout(timer)
  }, [activeAnchorIds])

  const runFocusedAgent = useMutation({
    mutationFn: (focus: string) => api.post(`/muses/${muse.id}/agent/run`, { focus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
      navigate(`/muse/${muse.id}/research`)
    },
  })

  const onFocusedResearch = useCallback(
    (focus: string) => { runFocusedAgent.mutate(focus) },
    [runFocusedAgent]
  )

  const activeBlockIds = new Set(activeAnchorIds.map((a) => a.split('.')[0]))
  const activeTitle = sections.find((s) => s.id === activeAnchorIds[0]?.split('.')[0])?.title

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {/* Screen-reader announcement of the section the Mentor is narrating. */}
      <div aria-live="polite" className="sr-only">
        {activeTitle ? `Now showing: ${activeTitle}` : ''}
      </div>
      <CanvasHeader muse={muse} stale={canvas.stale} />
      <div className={cn('max-w-3xl mx-auto px-6 pb-16 pt-2', DENSITY_GAP[canvas.theme?.density ?? 'balanced'])}>
        {sections.map((section) => (
          <BlockRenderer
            key={section.id}
            section={section}
            theme={canvas.theme}
            active={activeBlockIds.has(section.id)}
            paused={activeBlockIds.has(section.id) && tourPhase === 'detour'}
            museId={muse.id}
            onFocusedResearch={onFocusedResearch}
            focusedResearchPending={runFocusedAgent.isPending}
          />
        ))}

        {/* End-of-Canvas CTA */}
        <CanvasEndCTA muse={muse} />
      </div>

      {explainTarget && (
        <ExplainPopup
          target={explainTarget}
          onExplain={(t) => requestExplain(t.anchorId, t.selectedText)}
          onDismiss={clearExplain}
        />
      )}
    </div>
  )
}

// ── End-of-Canvas CTA ─────────────────────────────────────────────────────────

function CanvasEndCTA({ muse }: { muse: Muse }) {
  const navigate = useNavigate()
  const requestMentorOpen = useMentorPaneStore((s) => s.requestOpen)

  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface px-8 py-8 text-center shadow-sm">
      <p className="text-2xl mb-3">✦</p>
      <h3 className="text-lg font-semibold text-ink mb-1">Want to go deeper?</h3>
      <p className="text-sm text-ink-secondary mb-6 max-w-sm mx-auto">
        There's always more to learn about <strong>{muse.name}</strong>. Pick your next step.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => navigate(`/muse/${muse.id}/research`)}
        >
          Send the Research Agent
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/muse/${muse.id}/research`)}
        >
          Add a source
        </Button>
        <button
          onClick={requestMentorOpen}
          className="text-sm font-medium text-ink-secondary hover:text-accent transition-colors"
        >
          Ask the Mentor →
        </button>
      </div>
    </div>
  )
}

// ── Canvas header (stale banner) ─────────────────────────────────────────────

function CanvasHeader({ muse, stale }: { muse: Muse; stale: boolean }) {
  const queryClient = useQueryClient()
  const [awaitingBuild, setAwaitingBuild] = useState(false)

  const rebuildCanvas = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/canvas/build`, {}),
    onMutate: () => setAwaitingBuild(true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] }),
    onError: () => setAwaitingBuild(false),
  })

  const isRebuilding = rebuildCanvas.isPending || awaitingBuild

  if (isRebuilding) {
    return (
      <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-6 py-2 bg-accent-light border-b border-accent/20">
          <Spinner size="sm" />
          <p className="text-xs text-ink-secondary">Rebuilding your Canvas…</p>
        </div>
      </div>
    )
  }

  if (!stale) return null

  return (
    <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-warning/10 border-b border-warning/20">
        <p className="text-xs text-ink-secondary">
          Your knowledge has been updated since this Canvas was built.
        </p>
        <button
          onClick={() => rebuildCanvas.mutate()}
          className="text-xs font-semibold text-accent hover:text-accent-hover shrink-0 transition-colors"
        >
          Rebuild Canvas
        </button>
      </div>
    </div>
  )
}
