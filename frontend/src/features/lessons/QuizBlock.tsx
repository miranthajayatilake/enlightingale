import { useState } from 'react'
import { Button } from '@/design-system'
import type { QuizQuestion } from '@/lib/api'

interface Props {
  questions: QuizQuestion[]
  onComplete: (score: number, total: number) => void
}

export function QuizBlock({ questions, onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [submitted, setSubmitted] = useState(false)

  const setAnswer = (idx: number, value: string) => {
    if (submitted) return
    setAnswers((a) => ({ ...a, [idx]: value }))
  }

  const revealShortAnswer = (idx: number) => {
    setRevealed((r) => ({ ...r, [idx]: true }))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    // Score: auto-grade mc/tf; short-answer is self-assessed at 0 until user marks correct
    const score = questions.reduce((acc, q, i) => {
      if (q.type === 'short_answer') return acc
      return answers[i]?.trim() === q.correct_answer ? acc + 1 : acc
    }, 0)
    onComplete(score, questions.length)
  }

  const allAnswered = questions.every((q, i) => {
    if (q.type === 'short_answer') return true
    return answers[i] !== undefined
  })

  return (
    <div className="mt-12 border-t border-border pt-8 space-y-8">
      <h2 className="font-sans text-lg font-semibold text-ink">Check Your Understanding</h2>

      {questions.map((q, idx) => (
        <QuestionCard
          key={idx}
          index={idx}
          question={q}
          answer={answers[idx]}
          revealed={revealed[idx] ?? false}
          submitted={submitted}
          onAnswer={(v) => setAnswer(idx, v)}
          onReveal={() => revealShortAnswer(idx)}
        />
      ))}

      {!submitted && (
        <Button onClick={handleSubmit} disabled={!allAnswered}>
          Submit Quiz
        </Button>
      )}
    </div>
  )
}

// ── Individual question ────────────────────────────────────────────────────────

interface CardProps {
  index: number
  question: QuizQuestion
  answer: string | undefined
  revealed: boolean
  submitted: boolean
  onAnswer: (v: string) => void
  onReveal: () => void
}

function QuestionCard({ index, question, answer, revealed, submitted, onAnswer, onReveal }: CardProps) {
  const isCorrect = submitted && question.type !== 'short_answer'
    ? answer?.trim() === question.correct_answer
    : null

  return (
    <div className="space-y-3">
      <p className="font-sans text-sm font-medium text-ink leading-relaxed">
        <span className="text-ink-muted mr-2">{index + 1}.</span>
        {question.question}
      </p>

      {/* Multiple choice / True-False */}
      {(question.type === 'multiple_choice' || question.type === 'true_false') && (
        <div className="space-y-2">
          {question.options.map((opt) => {
            const selected = answer === opt
            const correct = submitted && opt === question.correct_answer
            const wrong = submitted && selected && opt !== question.correct_answer

            let cls = 'w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors '
            if (correct) cls += 'border-success bg-success/10 text-success font-medium'
            else if (wrong) cls += 'border-error bg-error/10 text-error'
            else if (selected) cls += 'border-accent bg-accent-light text-accent font-medium'
            else cls += 'border-border bg-surface text-ink hover:border-accent hover:bg-cream-hover'

            return (
              <button key={opt} className={cls} onClick={() => onAnswer(opt)} disabled={submitted}>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {/* Short answer */}
      {question.type === 'short_answer' && (
        <div className="space-y-2">
          <textarea
            value={answer ?? ''}
            onChange={(e) => onAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Write your answer…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface text-ink placeholder-ink-muted focus:outline-none focus:border-accent resize-none disabled:opacity-60"
          />
          {submitted && !revealed && (
            <button
              onClick={onReveal}
              className="text-xs text-accent hover:text-accent-hover underline"
            >
              Reveal expected answer
            </button>
          )}
          {revealed && (
            <div className="p-3 bg-accent-light border border-accent/30 rounded-lg text-sm text-ink-secondary">
              <span className="font-medium text-ink">Model answer: </span>
              {question.correct_answer}
            </div>
          )}
        </div>
      )}

      {/* Explanation (after submission for mc/tf) */}
      {submitted && question.type !== 'short_answer' && (
        <div className={`p-3 rounded-lg text-xs leading-relaxed ${isCorrect ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
          {isCorrect ? '✓ Correct — ' : '✗ Incorrect — '}
          <span className="text-ink-secondary">{question.explanation}</span>
        </div>
      )}
    </div>
  )
}
