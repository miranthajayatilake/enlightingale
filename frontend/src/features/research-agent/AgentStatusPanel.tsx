import { Spinner } from '@/design-system'
import type { AgentEvent } from './useAgentStatus'

interface Props {
  museeName: string
  latestEvent: AgentEvent | null
  subtopics: string[]
  searching: string | null
  progress: number
}

export function AgentStatusPanel({ museeName, latestEvent, subtopics, searching, progress }: Props) {
  const step = latestEvent?.step ?? latestEvent?.type ?? 'Starting…'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Spinner size="md" />
        <div>
          <h2 className="font-semibold text-ink text-base">
            Researching <span className="text-accent">{museeName}</span>
          </h2>
          <p className="text-ink-muted text-sm mt-0.5">{step}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Subtopic list */}
      {subtopics.length > 0 && (
        <div className="space-y-2">
          {subtopics.map((name, i) => {
            const isSearching = searching === name
            const isDone =
              latestEvent?.type === 'complete' ||
              (searching !== null &&
                subtopics.indexOf(searching) > i)

            return (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {isDone ? (
                    <span className="text-success text-sm">✓</span>
                  ) : isSearching ? (
                    <Spinner size="sm" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-border" />
                  )}
                </span>
                <span
                  className={[
                    'text-sm',
                    isDone ? 'text-ink-secondary line-through' : '',
                    isSearching ? 'text-ink font-medium' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Waiting state (before plan arrives) */}
      {subtopics.length === 0 && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-4 bg-border rounded animate-pulse"
              style={{ width: `${55 + i * 10}%`, opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
