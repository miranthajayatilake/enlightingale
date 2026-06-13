import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, type LessonDetail, type Muse } from '@/lib/api'
import { Button, Spinner } from '@/design-system'
import { QuizBlock } from '@/features/lessons/QuizBlock'

export function LessonReader() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [quizDone, setQuizDone] = useState(false)

  const { data: lesson, isLoading } = useQuery<LessonDetail>({
    queryKey: ['lesson', lessonId],
    queryFn: () => api.get<LessonDetail>(`/muses/${muse.id}/lessons/${lessonId}`),
    enabled: !!lessonId,
  })

  const { data: allLessons } = useQuery({
    queryKey: ['lessons', muse.id],
    queryFn: () => api.get<LessonDetail[]>(`/muses/${muse.id}/lessons`),
  })

  const saveProgress = useMutation({
    mutationFn: (body: { status: string; quiz_score?: number }) =>
      api.post(`/muses/${muse.id}/lessons/${lessonId}/progress`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] })
      queryClient.invalidateQueries({ queryKey: ['lessons', muse.id] })
    },
  })

  // Mark in_progress on open
  useEffect(() => {
    if (!lesson) return
    if (!lesson.progress || lesson.progress.status === 'not_started') {
      saveProgress.mutate({ status: 'in_progress' })
    }
    if (lesson.progress?.status === 'complete') {
      setQuizDone(true)
    }
  }, [lesson?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll progress bar
  useEffect(() => {
    const scrollEl = contentRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (!scrollEl) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl
      const total = scrollHeight - clientHeight
      setScrollProgress(total > 0 ? scrollTop / total : 0)
    }
    scrollEl.addEventListener('scroll', onScroll)
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [lesson])

  const handleQuizComplete = (score: number, _total: number) => {
    setQuizDone(true)
    saveProgress.mutate({ status: 'complete', quiz_score: score })
  }

  const nextLesson = allLessons?.find((l) => l.order === (lesson?.order ?? 0) + 1)

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted text-sm">
        Lesson not found.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Scroll progress bar */}
      <div className="h-0.5 bg-border shrink-0">
        <div
          className="h-full bg-accent transition-all duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Back link */}
      <div className="px-8 pt-5 shrink-0">
        <button
          onClick={() => navigate(`/muse/${muse.id}/lessons`)}
          className="text-sm text-ink-muted hover:text-accent transition-colors"
        >
          ← All Lessons
        </button>
      </div>

      {/* Lesson content */}
      <div ref={contentRef} className="flex-1 px-8 pb-16">
        <div className="max-w-[680px] mx-auto font-serif">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="font-serif text-3xl font-bold text-ink mt-8 mb-6 leading-tight">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="font-sans text-lg font-semibold text-ink mt-10 mb-4">
                  {children}
                </h2>
              ),
              p: ({ children }) => (
                <p className="font-serif text-base text-ink leading-relaxed mb-5">{children}</p>
              ),
              blockquote: ({ children }) => (
                <div className="my-6 px-5 py-4 bg-accent-light border-l-4 border-accent rounded-r-lg">
                  <div className="font-sans text-sm text-ink-secondary leading-relaxed italic">
                    {children}
                  </div>
                </div>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-ink">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-outside ml-5 space-y-2 mb-5 font-serif text-ink">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-outside ml-5 space-y-2 mb-5 font-serif text-ink">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed text-ink">{children}</li>
              ),
            }}
          >
            {lesson.content}
          </ReactMarkdown>

          {/* Quiz */}
          {lesson.quiz_questions.length > 0 && !quizDone && (
            <QuizBlock questions={lesson.quiz_questions} onComplete={handleQuizComplete} />
          )}

          {/* Completion state */}
          {quizDone && (
            <div className="mt-12 border-t border-border pt-8 flex items-center justify-between">
              <div>
                <p className="font-sans text-sm font-semibold text-success">
                  ✓ Lesson complete
                </p>
                {lesson.progress?.quiz_score != null && (
                  <p className="font-sans text-xs text-ink-muted mt-1">
                    Quiz score: {lesson.progress.quiz_score} / {lesson.quiz_questions.length}
                  </p>
                )}
              </div>
              {nextLesson ? (
                <Button onClick={() => navigate(`/muse/${muse.id}/lessons/${nextLesson.id}`)}>
                  Next Lesson →
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate(`/muse/${muse.id}/lessons`)}>
                  Back to Lessons
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
