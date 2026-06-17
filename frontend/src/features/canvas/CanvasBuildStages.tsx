import type { Muse } from '@/lib/api'
import { useAgentStatus } from '@/features/research-agent/useAgentStatus'

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

const RESEARCH_STAGE: Stage = {
  id: 'research',
  label: 'Researching the web',
  detail: "I'm scouting and curating the best sources.",
}

const SOURCES_STAGE: Stage = {
  id: 'sources',
  label: 'Reading the sources',
  detail: "I'm reading through everything I gathered.",
}

const KNOWLEDGE_STAGE: Stage = {
  id: 'knowledge',
  label: 'Making sense of it all',
  detail: "I'm synthesising the ideas, concepts, and open questions.",
}

const CANVAS_STAGE: Stage = {
  id: 'canvas',
  label: 'Building your page',
  detail: "I'm laying out your page, then planning how I'll walk you through it.",
}

const ORDER = ['research', 'sources', 'knowledge', 'canvas'] as const

export function CanvasBuildStages({ muse, klStatus, canvasStatus: _canvasStatus, hasProcessingResources }: Props) {
  const includeResearch = muse.agent_status !== 'idle'
  const hasResources = muse.resource_count > 0

  const stages: Stage[] = [
    ...(includeResearch ? [RESEARCH_STAGE] : []),
    ...(hasResources ? [SOURCES_STAGE] : []),
    KNOWLEDGE_STAGE,
    CANVAS_STAGE,
  ]

  const activeStageId: string = (() => {
    if (includeResearch && muse.agent_status === 'running') return 'research'
    if (hasResources && hasProcessingResources) return 'sources'
    if (klStatus !== 'ready') return 'knowledge'
    return 'canvas'
  })()

  const activeOrderIdx = ORDER.indexOf(activeStageId as typeof ORDER[number])

  function stageStatus(id: string): 'done' | 'active' | 'pending' {
    const idx = ORDER.indexOf(id as typeof ORDER[number])
    if (idx < activeOrderIdx) return 'done'
    if (idx === activeOrderIdx) return 'active'
    return 'pending'
  }

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[stages.length - 1]

  // Live Research Agent data — only consumed when research stage is active
  const { latestEvent, subtopics, searching } = useAgentStatus(muse.id, muse.agent_status)
  const researchProgress = latestEvent?.progress ?? 0
  const researchStep = latestEvent?.step ?? 'Planning research…'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Stage tracker */}
      <div className="mb-10 bg-surface border border-border rounded-xl p-6 shadow-sm">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-5">
          Getting ready
        </p>

        <div className="space-y-5">
          {stages.map((stage) => {
            const status = stageStatus(stage.id)
            const isResearchActive = stage.id === 'research' && status === 'active'

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

                {/* Label + detail + progress */}
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
                      <p className="text-xs text-ink-muted mt-0.5">
                        {isResearchActive ? researchStep : stage.detail}
                      </p>

                      {/* Research stage: real numeric fill bar + subtopic list */}
                      {isResearchActive ? (
                        <>
                          <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-700"
                              style={{ width: `${Math.max(researchProgress, 3)}%` }}
                            />
                          </div>

                          {subtopics.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                              {subtopics.slice(0, 5).map((name, i) => {
                                const isSearching = searching === name
                                const isDone = !isSearching && i < subtopics.indexOf(searching ?? '') || (!searching && i < subtopics.length - 1)
                                return (
                                  <li key={i} className="flex items-center gap-2 text-xs text-ink-muted">
                                    <span className="shrink-0 w-3.5 text-center">
                                      {isDone ? (
                                        <span className="text-success">✓</span>
                                      ) : isSearching ? (
                                        <span className="text-accent animate-pulse">⟳</span>
                                      ) : (
                                        <span className="text-border-strong">○</span>
                                      )}
                                    </span>
                                    <span className={isSearching ? 'text-ink' : ''}>{name}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </>
                      ) : (
                        /* Other stages: sweep animation */
                        <div className="mt-2 h-0.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full w-1/3 bg-accent rounded-full animate-build-sweep" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Warm message */}
        <p className="mt-5 pt-4 border-t border-border text-xs text-ink-muted leading-relaxed">
          {activeStage.id === 'research' && (
            <>I'm scouting the web for the best sources on <strong className="text-ink-secondary">{muse.name}</strong>…</>
          )}
          {activeStage.id === 'sources' && (
            <>I'm making sense of everything I gathered about <strong className="text-ink-secondary">{muse.name}</strong>.</>
          )}
          {activeStage.id === 'knowledge' && (
            <>I'm building up my understanding of <strong className="text-ink-secondary">{muse.name}</strong>. Sit tight — your page is on the way.</>
          )}
          {activeStage.id === 'canvas' && (
            <>Almost there — I'm laying out your page and getting ready to walk you through it.</>
          )}
        </p>
      </div>

      {/* Shimmer skeleton */}
      <div className="space-y-8 animate-pulse" aria-hidden="true">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-cream-muted mx-auto" />
          <div className="h-7 w-2/3 bg-cream-muted rounded mx-auto" />
          <div className="h-4 w-1/2 bg-cream-muted rounded mx-auto" />
        </div>
        <div className="space-y-2.5">
          <div className="h-5 w-40 bg-cream-muted rounded" />
          <div className="h-3.5 w-full bg-cream-muted rounded" />
          <div className="h-3.5 w-full bg-cream-muted rounded" />
          <div className="h-3.5 w-4/5 bg-cream-muted rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-5 w-48 bg-cream-muted rounded" />
          <div className="h-48 w-full bg-cream-muted rounded-xl" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-20 bg-cream-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
