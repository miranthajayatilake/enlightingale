import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Muse, type MuseCanvas } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTourStore } from './tourStore'
import { CanvasSectionShell } from './CanvasSectionShell'
import { getSectionComponent } from './sections'

interface Props {
  muse: Muse
  canvas: MuseCanvas
}

export function Canvas({ muse, canvas }: Props) {
  const sections = [...canvas.sections].sort((a, b) => a.order - b.order)
  const activeSectionId = useTourStore((s) => s.activeSectionId)
  const tourPhase = useTourStore((s) => s.tourPhase)
  const requestJump = useTourStore((s) => s.requestJump)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // During a Guided Tour, scroll the section the Mentor is narrating into view — unless the
  // user has scrolled manually in the last few seconds (don't fight them).
  useEffect(() => {
    if (!activeSectionId) return
    if (Date.now() - lastManualScrollRef.current < 4000) return
    const target = containerRef.current?.querySelector<HTMLElement>(
      `[data-canvas-section="${CSS.escape(activeSectionId)}"]`,
    )
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    autoScrollingRef.current = true
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    const timer = window.setTimeout(() => { autoScrollingRef.current = false }, 1000)
    return () => window.clearTimeout(timer)
  }, [activeSectionId])

  const activeTitle = sections.find((s) => s.id === activeSectionId)?.title

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {/* Screen-reader announcement of the section the Mentor is narrating. */}
      <div aria-live="polite" className="sr-only">
        {activeTitle ? `Now showing: ${activeTitle}` : ''}
      </div>
      <CanvasHeader muse={muse} stale={canvas.stale} />
      <div className="max-w-3xl mx-auto px-6 pb-16 pt-2 space-y-2">
        {sections.map((section) => {
          const SectionComponent = getSectionComponent(section.type)
          const active = section.id === activeSectionId
          return (
            <CanvasSectionShell
              key={section.id}
              id={section.id}
              active={active}
              paused={active && tourPhase === 'detour'}
              onExplain={requestJump}
            >
              <SectionComponent section={section} />
            </CanvasSectionShell>
          )
        })}
      </div>
    </div>
  )
}

function CanvasHeader({ muse, stale }: { muse: Muse; stale: boolean }) {
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const rebuildCanvas = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/canvas/build`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] }),
  })
  const rebuildKnowledge = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/knowledge/build`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['canvas', muse.id] })
    },
  })
  const runAgent = useMutation({
    mutationFn: () => api.post(`/muses/${muse.id}/agent/run`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['muse', muse.id] })
      queryClient.invalidateQueries({ queryKey: ['muses'] })
    },
  })

  const act = (m: { mutate: () => void }) => {
    m.mutate()
    setMenuOpen(false)
  }

  return (
    <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur-sm">
      {stale && (
        <div className="flex items-center justify-between gap-4 px-6 py-2 bg-warning/10 border-b border-warning/20">
          <p className="text-xs text-ink-secondary">
            New knowledge has been added since this overview was built.
          </p>
          <button
            onClick={() => rebuildKnowledge.mutate()}
            disabled={rebuildKnowledge.isPending}
            className="text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-50 shrink-0"
          >
            {rebuildKnowledge.isPending ? 'Refreshing…' : 'Refresh overview'}
          </button>
        </div>
      )}
      <div className="flex items-center justify-end px-6 py-2.5 border-b border-border">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Overview options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-cream-hover transition-colors"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-56 rounded-lg border border-border bg-surface shadow-lg py-1 z-20"
            >
              <MenuItem onClick={() => act(rebuildCanvas)}>Rebuild Canvas</MenuItem>
              <MenuItem onClick={() => act(rebuildKnowledge)}>Rebuild Knowledge Layer</MenuItem>
              <MenuItem onClick={() => act(runAgent)}>Run Research Agent again</MenuItem>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 text-sm text-ink hover:bg-cream-hover transition-colors'
      )}
    >
      {children}
    </button>
  )
}
