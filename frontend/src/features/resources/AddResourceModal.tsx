import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Button, Input, Textarea } from '@/design-system'
import { api, type Resource } from '@/lib/api'
import { cn } from '@/lib/utils'

type Tab = 'url' | 'upload' | 'note'

interface Props {
  museId: string
  open: boolean
  onClose: () => void
}

export function AddResourceModal({ museId, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('url')
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['resources', museId] })
    queryClient.invalidateQueries({ queryKey: ['muse', museId] })
    queryClient.invalidateQueries({ queryKey: ['muses'] })
  }

  const handleSuccess = () => {
    invalidate()
    onClose()
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'url',    label: '🔗  URL' },
    { id: 'upload', label: '📄  PDF' },
    { id: 'note',   label: '📝  Note' },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Add Resource" size="lg">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 p-1 bg-cream rounded-lg">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-100',
              tab === id
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'url'    && <UrlTab    museId={museId} onSuccess={handleSuccess} onCancel={onClose} />}
      {tab === 'upload' && <UploadTab museId={museId} onSuccess={handleSuccess} onCancel={onClose} />}
      {tab === 'note'   && <NoteTab   museId={museId} onSuccess={handleSuccess} onCancel={onClose} />}
    </Modal>
  )
}

// ── URL tab ──────────────────────────────────────────────────────────────────

function UrlTab({ museId, onSuccess, onCancel }: { museId: string; onSuccess: () => void; onCancel: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Resource>(`/muses/${museId}/resources`, { source_type: 'url', url }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!url.trim()) { setError('Please enter a URL'); return }
    try { new URL(url) } catch { setError('Please enter a valid URL'); return }
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="URL"
        type="url"
        placeholder="https://example.com/article"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        error={error}
        autoFocus
      />
      <p className="text-xs text-ink-muted">
        Enlightingale will scrape the page and generate a summary.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending} disabled={!url.trim()}>
          Add URL
        </Button>
      </div>
    </form>
  )
}

// ── Upload tab ────────────────────────────────────────────────────────────────

function UploadTab({ museId, onSuccess, onCancel }: { museId: string; onSuccess: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file!)
      return api.upload<Resource>(`/muses/${museId}/resources/upload`, fd)
    },
    onSuccess,
    onError: (err: Error) => setError(err.message),
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setError('')
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported')
      return
    }
    setFile(f)
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
          file ? 'border-accent bg-accent-light' : 'border-border hover:border-border-strong',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFile}
        />
        {file ? (
          <>
            <p className="text-2xl mb-2">📄</p>
            <p className="font-medium text-ink text-sm">{file.name}</p>
            <p className="text-xs text-ink-muted mt-1">
              {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl mb-2 text-ink-muted">📄</p>
            <p className="text-sm font-medium text-ink">Click to select a PDF</p>
            <p className="text-xs text-ink-muted mt-1">PDF files only</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!file}
        >
          Upload PDF
        </Button>
      </div>
    </div>
  )
}

// ── Note tab ──────────────────────────────────────────────────────────────────

function NoteTab({ museId, onSuccess, onCancel }: { museId: string; onSuccess: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Resource>(`/muses/${museId}/resources`, {
        source_type: 'text',
        title,
        content,
      }),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Please enter a title'); return }
    if (!content.trim()) { setError('Please enter some content'); return }
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Title"
        placeholder="My notes on quantum entanglement"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <Textarea
        label="Content"
        placeholder="Paste or type your notes here…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!title.trim() || !content.trim()}
        >
          Save Note
        </Button>
      </div>
    </form>
  )
}
