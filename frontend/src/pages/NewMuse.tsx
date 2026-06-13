import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type Muse, type Resource } from '@/lib/api'
import { Button, Input, Textarea } from '@/design-system'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3 | 4
type Level = 'beginner' | 'some' | 'familiar'
type SPType = 'url' | 'pdf' | 'note'

interface StartingPoint {
  localId: string
  type: SPType
  url?: string
  file?: File
  noteTitle?: string
  noteContent?: string
  label: string
}

const LEVELS: { value: Level; label: string; desc: string; emoji: string }[] = [
  { value: 'beginner', label: 'Starting fresh',    desc: 'I know almost nothing about this yet',         emoji: '🌱' },
  { value: 'some',     label: 'Some background',   desc: "I've read a bit and have a rough idea",        emoji: '📖' },
  { value: 'familiar', label: 'I know the basics', desc: 'I want to go much deeper than where I am now', emoji: '🔍' },
]

const SP_ICON: Record<SPType, string> = { url: '🔗', pdf: '📄', note: '📝' }

export function NewMuse() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep]           = useState<Step>(1)
  const [name, setName]           = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel]         = useState<Level>('beginner')
  const [points, setPoints]       = useState<StartingPoint[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function removePoint(id: string) {
    setPoints((prev) => prev.filter((p) => p.localId !== id))
  }

  async function createMuseAndResources(withPoints: StartingPoint[]) {
    setSubmitError('')
    setSubmitting(true)
    try {
      const muse = await api.post<Muse>('/muses', { name, description, knowledge_level: level })
      queryClient.invalidateQueries({ queryKey: ['muses'] })

      // Fire resource creation for each starting point; failures are soft (pipeline still runs).
      await Promise.allSettled(
        withPoints.map((sp) => {
          if (sp.type === 'url') {
            return api.post<Resource>(`/muses/${muse.id}/resources`, { source_type: 'url', url: sp.url })
          }
          if (sp.type === 'pdf') {
            const fd = new FormData()
            fd.append('file', sp.file!)
            return api.upload<Resource>(`/muses/${muse.id}/resources/upload`, fd)
          }
          // note
          return api.post<Resource>(`/muses/${muse.id}/resources`, {
            source_type: 'text',
            title: sp.noteTitle,
            content: sp.noteContent,
          })
        })
      )

      navigate(`/muse/${muse.id}`)
    } catch (err) {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-8">
      <div className="w-full max-w-lg">
        {/* Step indicator — 4 segments; step 4 optional */}
        <div className="flex items-center gap-2 mb-10">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-300',
                s < step  ? 'bg-accent' :
                s === step ? 'bg-accent' :
                s === 4   ? 'bg-border/60' :
                'bg-border',
              )}
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
              <Button onClick={() => setStep(2)} disabled={!name.trim()}>Continue →</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">What do you want to understand?</h1>
              <p className="text-ink-secondary text-sm">
                Be specific — this guides the Research Agent and shapes your Canvas.
              </p>
            </div>
            <Textarea
              placeholder="e.g. Why did the Roman Republic collapse, and what made it so powerful before it did?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={!description.trim()}>Continue →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">Where are you starting from?</h1>
              <p className="text-ink-secondary text-sm">
                This calibrates the depth of your Canvas and the Research Agent's choices.
              </p>
            </div>
            <div className="space-y-3">
              {LEVELS.map(({ value, label, desc, emoji }) => (
                <button
                  key={value}
                  onClick={() => setLevel(value)}
                  className={cn(
                    'w-full text-left px-4 py-4 rounded-lg border transition-all duration-150',
                    level === value
                      ? 'border-accent bg-accent-light ring-2 ring-accent/20'
                      : 'border-border bg-surface hover:border-border-strong hover:bg-cream-hover',
                  )}
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
              <Button onClick={() => setStep(4)}>Continue →</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <Step4
            museName={name}
            points={points}
            setPoints={setPoints}
            onBack={() => setStep(3)}
            onRemove={removePoint}
            onSkip={() => createMuseAndResources([])}
            onCreate={() => createMuseAndResources(points)}
            submitting={submitting}
            error={submitError}
          />
        )}
      </div>
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

interface Step4Props {
  museName: string
  points: StartingPoint[]
  setPoints: React.Dispatch<React.SetStateAction<StartingPoint[]>>
  onBack: () => void
  onRemove: (id: string) => void
  onSkip: () => void
  onCreate: () => void
  submitting: boolean
  error: string
}

function Step4({ museName, points, setPoints, onBack, onRemove, onSkip, onCreate, submitting, error }: Step4Props) {
  const [tab, setTab] = useState<SPType>('url')

  function addPoint(sp: Omit<StartingPoint, 'localId'>) {
    setPoints((prev) => [...prev, { ...sp, localId: crypto.randomUUID() }])
  }

  const TABS: { id: SPType; label: string }[] = [
    { id: 'url',  label: '🔗  URL' },
    { id: 'pdf',  label: '📄  PDF' },
    { id: 'note', label: '📝  Note' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-ink">Give it a head start</h1>
          <span className="text-xs font-medium text-ink-muted bg-cream-hover px-2 py-0.5 rounded-full">optional</span>
        </div>
        <p className="text-ink-secondary text-sm">
          Have a great article, paper, or note about <strong>{museName}</strong>? Drop it in — your Canvas will reflect it right away.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-cream rounded-lg">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
              tab === id ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'url'  && <UrlAdder  onAdd={addPoint} />}
      {tab === 'pdf'  && <PdfAdder  onAdd={addPoint} />}
      {tab === 'note' && <NoteAdder onAdd={addPoint} />}

      {/* Added items list */}
      {points.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Added</p>
          {points.map((sp) => (
            <div key={sp.localId} className="flex items-center gap-3 px-3 py-2.5 bg-surface border border-border rounded-lg">
              <span className="text-base shrink-0">{SP_ICON[sp.type]}</span>
              <p className="flex-1 text-sm text-ink truncate">{sp.label}</p>
              <button
                onClick={() => onRemove(sp.localId)}
                className="text-xs text-ink-muted hover:text-error transition-colors shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-error text-center">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>← Back</Button>
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            disabled={submitting}
            className="text-sm text-ink-muted hover:text-ink disabled:opacity-50 transition-colors"
          >
            Skip for now
          </button>
          <Button onClick={onCreate} loading={submitting}>
            Create Muse ✦
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Adder sub-components ──────────────────────────────────────────────────────

function UrlAdder({ onAdd }: { onAdd: (sp: Omit<StartingPoint, 'localId'>) => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  function handleAdd() {
    setError('')
    if (!url.trim()) { setError('Please enter a URL'); return }
    try { new URL(url) } catch { setError('Please enter a valid URL'); return }
    let label = url
    try { label = new URL(url).hostname } catch { /* keep full url */ }
    onAdd({ type: 'url', url: url.trim(), label })
    setUrl('')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com/article"
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError('') }}
          error={error}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          autoFocus
        />
        <Button variant="secondary" onClick={handleAdd} disabled={!url.trim()} className="shrink-0">
          Add
        </Button>
      </div>
    </div>
  )
}

function PdfAdder({ onAdd }: { onAdd: (sp: Omit<StartingPoint, 'localId'>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setError('')
    setFile(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported'); return }
    if (f.size > 50 * 1024 * 1024) { setError('File is too large. Maximum size is 50 MB.'); return }
    setFile(f)
  }

  function handleAdd() {
    if (!file) return
    onAdd({ type: 'pdf', file, label: file.name })
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          file ? 'border-accent bg-accent-light' : 'border-border hover:border-border-strong',
        )}
      >
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
        {file ? (
          <>
            <p className="text-2xl mb-1">📄</p>
            <p className="font-medium text-ink text-sm">{file.name}</p>
            <p className="text-xs text-ink-muted mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
          </>
        ) : (
          <>
            <p className="text-2xl mb-1 text-ink-muted">📄</p>
            <p className="text-sm font-medium text-ink">Click to select a PDF</p>
            <p className="text-xs text-ink-muted mt-0.5">PDF files only</p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {file && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleAdd}>Add PDF</Button>
        </div>
      )}
    </div>
  )
}

function NoteAdder({ onAdd }: { onAdd: (sp: Omit<StartingPoint, 'localId'>) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  function handleAdd() {
    setError('')
    if (!title.trim()) { setError('Please enter a title'); return }
    if (!content.trim()) { setError('Please enter some content'); return }
    onAdd({ type: 'note', noteTitle: title.trim(), noteContent: content.trim(), label: title.trim() })
    setTitle('')
    setContent('')
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Title"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setError('') }}
        autoFocus
      />
      <Textarea
        placeholder="Paste or type your notes here…"
        value={content}
        onChange={(e) => { setContent(e.target.value); setError('') }}
        rows={5}
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={handleAdd}
          disabled={!title.trim() || !content.trim()}
        >
          Add Note
        </Button>
      </div>
    </div>
  )
}
