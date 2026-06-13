import type { Muse } from '@/lib/api'

interface Props {
  muse: Muse
  klStatus: string
  canvasStatus: string
  hasProcessingResources: boolean
}

interface Stage {
  id: string
  label: string
  detail: string
}

const BASE_STAGES: Stage[] = [
  {
    id: 'knowledge',
    label: 'Building your knowledge layer',
    detail: 'Synthesising insights, extracting concepts, finding gaps.',
  },
  {
    id: 'canvas',
    label: 'Composing your Canvas',
    detail: 'Planning and writing each section of your visual overview.',
  },
]

const SOURCES_STAGE: Stage = {
  id: 'sources',
  label: 'Reading your sources',
  detail: 'Fetching, scraping, and summarising everything you shared.',
}

export function CanvasBuildStages({ muse, klStatus, canvasStatus: _canvasStatus, hasProcessingResources }: Props) {
  const hasResources = muse.resource_count > 0
  const stages: Stage[] = hasResources ? [SOURCES_STAGE, ...BASE_STAGES] : BASE_STAGES

  // Determine the index of the currently active stage.
  // Sources is "done" once no resources are processing.
  // Knowledge is "done" when kl.status === 'ready'.
  // Canvas is always the last active stage in this component (ready = we'd show Canvas).
  function getActiveIdx(): number {
    if (hasResources) {
      if (hasProcessingResources) return 0      // sources: still reading
      if (klStatus !== 'ready') return 1        // knowledge: sources done, kl building
      return 2                                  // canvas: kl done, composing
    } else {
      if (klStatus !== 'ready') return 0        // knowledge: building
      return 1                                  // canvas: composing
    }
  }

  const activeIdx = getActiveIdx()

  const stepStatus = (idx: number): 'done' | 'active' | 'pending' => {
    if (idx < activeIdx) return 'done'
    if (idx === activeIdx) return 'active'
    return 'pending'
  }

  const activeStage = stages[activeIdx]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Stage tracker */}
      <div className="mb-10 bg-surface border border-border rounded-xl p-6 shadow-sm">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-5">
          Getting ready
        </p>

        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const status = stepStatus(idx)
            return (
              <div key={stage.id} className="flex items-start gap-4">
                {/* Bullet */}
                <div className="shrink-0 mt-0.5">
                  {status === 'done' && (
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  {status === 'active' && (
                    <div className="w-6 h-6 rounded-full bg-accent-light border-2 border-accent flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    </div>
                  )}
                  {status === 'pending' && (
                    <div className="w-6 h-6 rounded-full border-2 border-border" />
                  )}
                </div>

                {/* Label + detail + progress bar */}
                <div className="flex-1 min-w-0">
                  <p className={[
                    'text-sm font-medium leading-snug',
                    status === 'active'  ? 'text-ink' :
                    status === 'done'    ? 'text-ink-secondary opacity-60' :
                    'text-ink-muted',
                  ].join(' ')}>
                    {stage.label}
                  </p>
                  {status === 'active' && (
                    <>
                      <p className="text-xs text-ink-muted mt-0.5">{stage.detail}</p>
                      <div className="mt-2 h-0.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-accent rounded-full animate-build-sweep" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Warm message for active stage */}
        <p className="mt-5 pt-4 border-t border-border text-xs text-ink-muted leading-relaxed">
          {activeStage.id === 'sources' && (
            <>Pulling in everything you shared about <strong className="text-ink-secondary">{muse.name}</strong>. This usually takes under a minute.</>
          )}
          {activeStage.id === 'knowledge' && (
            <>Your Mentor is learning about <strong className="text-ink-secondary">{muse.name}</strong>. Sit tight — a rich Canvas is on the way.</>
          )}
          {activeStage.id === 'canvas' && (
            <>Almost there. Writing your visual overview and preparing your Mentor for a guided tour.</>
          )}
        </p>
      </div>

      {/* Shimmer sections — shaped like real Canvas blocks */}
      <div className="space-y-8 animate-pulse" aria-hidden="true">
        {/* hero */}
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-cream-muted mx-auto" />
          <div className="h-7 w-2/3 bg-cream-muted rounded mx-auto" />
          <div className="h-4 w-1/2 bg-cream-muted rounded mx-auto" />
        </div>
        {/* prose */}
        <div className="space-y-2.5">
          <div className="h-5 w-40 bg-cream-muted rounded" />
          <div className="h-3.5 w-full bg-cream-muted rounded" />
          <div className="h-3.5 w-full bg-cream-muted rounded" />
          <div className="h-3.5 w-4/5 bg-cream-muted rounded" />
        </div>
        {/* concept cluster */}
        <div className="space-y-3">
          <div className="h-5 w-48 bg-cream-muted rounded" />
          <div className="h-48 w-full bg-cream-muted rounded-xl" />
        </div>
        {/* stat band */}
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-20 bg-cream-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
