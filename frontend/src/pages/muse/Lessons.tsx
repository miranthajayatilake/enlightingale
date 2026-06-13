import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type GenerationJob, type KnowledgeLayer, type Lesson, type Muse } from '@/lib/api'
import { Badge, Button, Card, Spinner } from '@/design-system'
import { cn } from '@/lib/utils'

export function Lessons() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null)

  const { data: kl } = useQuery<KnowledgeLayer | null>({
    queryKey: ['knowledge', muse.id],
    queryFn: () => api.get<KnowledgeLayer | null>(`/muses/${muse.id}/knowledge`),
  })

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ['lessons', muse.id],
    queryFn: () => api.get<Lesson[]>(`/muses/${muse.id}/lessons`),
  })

  const { data: genJob } = useQuery<GenerationJob | null>({
    queryKey: ['lesson-generation', muse.id],
    queryFn: () => api.get<GenerationJob | null>(`/muses/${muse.id}/lessons/generation`),
    refetchInterval: (query) => {
      const d = query.state.data as GenerationJob | null | undefined
      if (d?.status === 'queued' || d?.status === 'running') return 2000
      return false
    },
  })

  // When generation completes, invalidate lessons list
  useEffect(() => {
    if (genJob?.status === 'complete') {
      queryClient.invalidateQueries({ queryKey: ['lessons', muse.id] })
      setGeneratingJobId(null)
    }
  }, [genJob?.status, muse.id, queryClient])

  const generate = useMutation({
    mutationFn: () => api.post<GenerationJob>(`/muses/${muse.id}/lessons/generate`, {}),
    onSuccess: (job) => {
      setGeneratingJobId(job.id)
      queryClient.invalidateQueries({ queryKey: ['lesson-generation', muse.id] })
    },
  })

  const isGenerating =
    generatingJobId !== null ||
    genJob?.status === 'queued' ||
    genJob?.status === 'running'

  const klReady = kl?.status === 'ready'
  const hasLessons = lessons.length > 0
  const completedCount = lessons.filter((l) => l.progress?.status === 'complete').length

  // ── No knowledge layer ─────────────────────────────────────────────────────
  if (!kl || kl.status === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8 py-24">
        <p className="text-2xl">📚</p>
        <p className="font-semibold text-ink">Build the Knowledge Layer first</p>
        <p className="text-sm text-ink-secondary max-w-sm">
          Lessons are generated from your Muse's knowledge layer. Head to the Overview tab to build
          it.
        </p>
        <Button variant="secondary" onClick={() => navigate(`/muse/${muse.id}`)}>
          Go to Overview
        </Button>
      </div>
    )
  }

  if (kl.status === 'building') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8 py-24">
        <Spinner size="lg" />
        <p className="font-semibold text-ink">Building knowledge layer…</p>
        <p className="text-sm text-ink-secondary max-w-sm">
          This usually takes a minute. Lessons will be available once it's complete.
        </p>
      </div>
    )
  }

  if (kl.status === 'failed') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8 py-24">
        <p className="text-2xl">⚠️</p>
        <p className="font-semibold text-ink">Knowledge layer build failed</p>
        <p className="text-sm text-ink-secondary max-w-sm">
          {kl.error ?? 'An error occurred while building the knowledge layer.'}
        </p>
        <Button variant="secondary" onClick={() => navigate(`/muse/${muse.id}`)}>
          Go to Overview
        </Button>
      </div>
    )
  }

  if (kl.status !== 'ready') {
    return null
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Lesson Flow</h1>
          {hasLessons && (
            <p className="text-sm text-ink-secondary mt-1">
              {completedCount} of {lessons.length} lessons complete
            </p>
          )}
        </div>
        {klReady && (
          <Button
            onClick={() => generate.mutate()}
            loading={generate.isPending || isGenerating}
            disabled={isGenerating}
            variant={hasLessons ? 'secondary' : 'primary'}
            className="shrink-0"
          >
            {hasLessons ? 'Regenerate' : 'Generate Lessons'}
          </Button>
        )}
      </div>

      {/* Generating state */}
      {isGenerating && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Spinner size="md" />
            <p className="text-sm font-medium text-ink">
              {genJob?.status_message ?? 'Generating lessons…'}
            </p>
          </div>
          {genJob && genJob.progress > 0 && (
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${genJob.progress}%` }}
              />
            </div>
          )}
        </Card>
      )}

      {/* Failed */}
      {genJob?.status === 'failed' && !isGenerating && (
        <Card className="p-4 border-error/30 bg-error/5">
          <p className="text-sm text-error">
            Generation failed — {genJob.status_message}
          </p>
        </Card>
      )}

      {/* Empty state — no lessons yet */}
      {!isGenerating && !hasLessons && !generate.isPending && (
        <div className="flex flex-col items-center gap-3 text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-2xl">🎓</p>
          <p className="font-medium text-ink">No lessons yet</p>
          <p className="text-sm text-ink-secondary max-w-xs">
            Click "Generate Lessons" to create a personalized curriculum from your knowledge base.
          </p>
        </div>
      )}

      {/* Lesson list */}
      {hasLessons && !isGenerating && (
        <div className="space-y-3">
          {lessons.map((lesson, i) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={i}
              museId={muse.id}
              onOpen={() => navigate(`/muse/${muse.id}/lessons/${lesson.id}`)}
            />
          ))}
        </div>
      )}
    </div>
    </div>
  )
}

// ── Lesson card ──────────────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: Lesson
  index: number
  museId: string
  onOpen: () => void
}

function LessonCard({ lesson, index, onOpen }: LessonCardProps) {
  const status = lesson.progress?.status ?? 'not_started'

  return (
    <button
      onClick={onOpen}
      className="w-full text-left group"
    >
      <Card className="p-4 group-hover:shadow-md group-hover:border-border-strong transition-all duration-150">
        <div className="flex items-start gap-4">
          {/* Progress indicator */}
          <div
            className={cn(
              'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5',
              status === 'complete'
                ? 'bg-success text-white'
                : status === 'in_progress'
                ? 'bg-accent text-white'
                : 'bg-cream-muted border-2 border-border-strong text-ink-secondary'
            )}
          >
            {status === 'complete' ? '✓' : index + 1}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-ink group-hover:text-accent transition-colors leading-snug">
                {lesson.title}
              </p>
              <StatusBadge status={status} score={lesson.progress?.quiz_score} />
            </div>
            {lesson.summary && (
              <p className="text-sm text-ink-secondary mt-1 leading-relaxed line-clamp-2">
                {lesson.summary}
              </p>
            )}
            {lesson.key_concepts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {lesson.key_concepts.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 bg-cream text-ink-muted text-xs rounded-full border border-border"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </button>
  )
}

function StatusBadge({ status, score }: { status: string; score?: number | null }) {
  if (status === 'complete') {
    return (
      <Badge variant="success" className="shrink-0">
        {score != null ? `${score} correct` : 'Done'}
      </Badge>
    )
  }
  if (status === 'in_progress') {
    return <Badge variant="accent" className="shrink-0">In Progress</Badge>
  }
  return null
}
