import { useEffect, useRef } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Button } from '@/design-system'
import { useVoiceSession, type VoiceStatus } from '@/features/voice/useVoiceSession'
import type { Muse } from '@/lib/api'

export function Voice() {
  const { muse } = useOutletContext<{ muse: Muse }>()
  const navigate = useNavigate()
  const { status, transcript, isMuted, error, start, end, toggleMute } = useVoiceSession(muse.id)

  const transcriptRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript])

  // ── Idle — start screen ────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/40 to-accent/10 flex items-center justify-center text-3xl shadow-md">
          🎙
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink">Talk to Mentor</h2>
          <p className="text-sm text-ink-secondary mt-1 max-w-xs">
            A real-time voice tutor that knows everything about{' '}
            <span className="font-medium text-ink">{muse.name}</span>. Powered by Gemini 2.0 Flash Live.
          </p>
        </div>
        <Button onClick={start}>Start Voice Session</Button>
        <p className="text-xs text-ink-muted">Microphone access required</p>
      </div>
    )
  }

  // ── Ended ──────────────────────────────────────────────────────────────────
  if (status === 'ended') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-8">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-2xl">
          ✓
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink">Session ended</h2>
          {transcript.length > 0 && (
            <p className="text-sm text-ink-secondary mt-1">
              You covered {transcript.filter((t) => t.role === 'model').length} exchanges with Mentor.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button onClick={start}>Start New Session</Button>
          <Button variant="secondary" onClick={() => navigate(`/muse/${muse.id}/lessons`)}>
            Go to Lessons
          </Button>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-2xl">
          ⚠
        </div>
        <div>
          <p className="font-semibold text-ink">Connection failed</p>
          <p className="text-sm text-error mt-1 max-w-xs">{error}</p>
        </div>
        <Button onClick={start}>Try Again</Button>
      </div>
    )
  }

  // ── Active session (connecting / listening / speaking / processing) ─────────
  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-cream">
        <div className="flex items-center gap-2">
          <span className="text-lg">{muse.cover_emoji ?? '✦'}</span>
          <span className="font-medium text-ink text-sm">{muse.name}</span>
        </div>
        <button
          onClick={end}
          className="text-sm text-ink-muted hover:text-error transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Orb + status */}
      <div className="shrink-0 flex flex-col items-center gap-4 py-10">
        <VoiceOrb status={status} />
        <StatusLabel status={status} />
      </div>

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto px-6 pb-4 space-y-2"
      >
        {transcript.length === 0 && status === 'listening' && (
          <p className="text-center text-ink-muted text-sm pt-4">
            Mentor is ready — say hello or ask a question.
          </p>
        )}
        {transcript.map((entry, i) => (
          <TranscriptLine key={i} entry={entry} />
        ))}
      </div>

      {/* Controls */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-6 py-5 border-t border-border">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={[
            'w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all border',
            isMuted
              ? 'bg-error/10 border-error/30 text-error'
              : 'bg-cream border-border text-ink-secondary hover:border-accent hover:text-accent',
          ].join(' ')}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          onClick={end}
          className="w-14 h-14 rounded-full bg-error flex items-center justify-center text-white text-xl shadow-md hover:bg-error/80 transition-colors"
          title="End session"
          aria-label="End voice session"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Orb ──────────────────────────────────────────────────────────────────────

function VoiceOrb({ status }: { status: VoiceStatus }) {
  const base = 'w-36 h-36 rounded-full relative flex items-center justify-center'

  if (status === 'connecting') {
    return (
      <div className={base}>
        <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/40 to-accent/10" />
      </div>
    )
  }

  if (status === 'speaking') {
    return (
      <div className={base}>
        {/* Three expanding rings */}
        <div className="absolute inset-0 rounded-full bg-accent/15 animate-ping" />
        <div
          className="absolute inset-4 rounded-full bg-accent/20 animate-ping"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="absolute inset-8 rounded-full bg-accent/25 animate-ping"
          style={{ animationDelay: '300ms' }}
        />
        {/* Core */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent-hover shadow-lg" />
      </div>
    )
  }

  if (status === 'listening') {
    return (
      <div className={`${base} animate-pulse`}>
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-accent/60 to-accent/20 shadow-md" />
      </div>
    )
  }

  // idle / processing / error
  return (
    <div className={base}>
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-accent/30 to-accent/10" />
    </div>
  )
}

// ── Status label ─────────────────────────────────────────────────────────────

function StatusLabel({ status }: { status: VoiceStatus }) {
  const labels: Record<VoiceStatus, string> = {
    idle:       '',
    connecting: 'Connecting…',
    listening:  'Listening',
    speaking:   'Mentor is speaking…',
    processing: 'Thinking…',
    error:      'Error',
    ended:      '',
  }
  return (
    <p className="text-sm font-medium text-ink-secondary tracking-wide">
      {labels[status]}
    </p>
  )
}

// ── Transcript line ───────────────────────────────────────────────────────────

function TranscriptLine({ entry }: { entry: { role: 'user' | 'model'; text: string } }) {
  if (entry.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[72%] px-3 py-2 bg-accent/10 text-accent rounded-xl text-sm leading-relaxed">
          {entry.text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-3 py-2 bg-surface border border-border rounded-xl text-sm text-ink leading-relaxed shadow-sm">
        <span className="text-xs text-ink-muted font-medium mr-1.5">Mentor</span>
        {entry.text}
      </div>
    </div>
  )
}
