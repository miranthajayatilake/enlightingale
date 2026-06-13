import { useEffect, useRef, useState } from 'react'
import { Button } from '@/design-system'

// Web Speech API shim types — not in TS DOM lib at ES2020 target
interface SpeechRecognitionResult {
  readonly length: number
  readonly [index: number]: { transcript: string }
}
interface SpeechRecognitionEvent {
  readonly results: { readonly length: number; readonly [index: number]: SpeechRecognitionResult }
}
interface AnySpeechRec {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => AnySpeechRec
  webkitSpeechRecognition?: new () => AnySpeechRec
}

interface Props {
  onSend: (message: string) => void
  disabled: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask anything about this topic…' }: Props) {
  const [value, setValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<AnySpeechRec | null>(null)

  const hasVoice = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const send = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const win = window as WindowWithSpeech
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition
    if (!Ctor) return

    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e) => {
      const parts: string[] = []
      for (let i = 0; i < e.results.length; i++) {
        parts.push(e.results[i][0].transcript)
      }
      setValue(parts.join(''))
    }

    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)

    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }

  return (
    <div className="flex items-end gap-2 p-4 border-t border-border bg-surface">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Thinking…' : placeholder}
        rows={1}
        className="flex-1 resize-none rounded-lg border border-border bg-cream px-4 py-3 text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        style={{ minHeight: '44px', maxHeight: '160px' }}
      />

      {hasVoice && (
        <button
          onClick={toggleVoice}
          disabled={disabled}
          title={isListening ? 'Stop listening' : 'Speak your question'}
          aria-label={isListening ? 'Stop listening' : 'Speak your question'}
          className={[
            'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40',
            isListening
              ? 'bg-error/10 text-error border border-error/30 animate-pulse'
              : 'bg-cream border border-border text-ink-muted hover:text-accent hover:border-accent',
          ].join(' ')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-5 0v-4A2.5 2.5 0 0 1 8 1Z" fill="currentColor"/>
            <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      <Button
        onClick={send}
        disabled={!value.trim() || disabled}
        className="shrink-0 h-10 px-4"
        aria-label="Send message"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Button>
    </div>
  )
}
