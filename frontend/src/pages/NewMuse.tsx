import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Muse } from '@/lib/api'
import { Button, Input, Textarea } from '@/design-system'

type Step = 1 | 2 | 3
type Level = 'beginner' | 'some' | 'familiar'

const LEVELS: { value: Level; label: string; desc: string; emoji: string }[] = [
  { value: 'beginner', label: 'Starting fresh',      desc: 'I know almost nothing about this yet',          emoji: '🌱' },
  { value: 'some',     label: 'Some background',     desc: 'I\'ve read a bit and have a rough idea',         emoji: '📖' },
  { value: 'familiar', label: 'I know the basics',   desc: 'I want to go much deeper than where I am now',  emoji: '🔍' },
]

export function NewMuse() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState<Level>('beginner')

  const create = useMutation({
    mutationFn: () =>
      api.post<Muse>('/muses', {
        name,
        description,
        knowledge_level: level,
      }),
    onSuccess: (muse) => {
      queryClient.invalidateQueries({ queryKey: ['muses'] })
      navigate(`/muse/${muse.id}`)
    },
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-8">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={[
                'h-1 flex-1 rounded-full transition-colors duration-300',
                s <= step ? 'bg-accent' : 'bg-border',
              ].join(' ')}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">Name your Muse</h1>
              <p className="text-ink-secondary text-sm">What topic do you want to explore?</p>
            </div>
            <Input
              placeholder="e.g. The Roman Republic, Natural Wine, Quantum Computing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!name.trim()}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">What do you want to understand?</h1>
              <p className="text-ink-secondary text-sm">
                Be specific — this guides the Research Agent and shapes your lessons.
              </p>
            </div>
            <Textarea
              placeholder={`e.g. Why did the Roman Republic collapse, and what made it so powerful before it did?`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={!description.trim()}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">Where are you starting from?</h1>
              <p className="text-ink-secondary text-sm">
                This calibrates the depth of your lessons and the Research Agent's choices.
              </p>
            </div>
            <div className="space-y-3">
              {LEVELS.map(({ value, label, desc, emoji }) => (
                <button
                  key={value}
                  onClick={() => setLevel(value)}
                  className={[
                    'w-full text-left px-4 py-4 rounded-lg border transition-all duration-150',
                    level === value
                      ? 'border-accent bg-accent-light ring-2 ring-accent/20'
                      : 'border-border bg-surface hover:border-border-strong hover:bg-cream-hover',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                      <p className="font-medium text-ink text-sm">{label}</p>
                      <p className="text-ink-muted text-xs mt-0.5">{desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
              <Button
                onClick={() => create.mutate()}
                loading={create.isPending}
              >
                Create Muse ✦
              </Button>
            </div>
            {create.isError && (
              <p className="text-sm text-error text-center">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
