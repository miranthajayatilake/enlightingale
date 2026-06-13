import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVoiceSession, type VoiceStatus } from '@/features/voice/useVoiceSession'
import { useTourStore, type TourPhase } from '@/features/canvas/tourStore'
import { useMentorPaneStore } from '@/features/voice/mentorPaneStore'
import type { Muse } from '@/lib/api'
import { Spinner } from '@/design-system'
import { cn } from '@/lib/utils'

interface Props {
  muse: Muse
}

export function MentorPane({ muse }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { status, transcript, isMuted, error, start, end, toggleMute } = useVoiceSession(muse.id)
  const tourPhase = useTourStore((s) => s.tourPhase)
  const openRequested = useMentorPaneStore((s) => s.openRequested)
  const clearOpenRequest = useMentorPaneStore((s) => s.clearOpenRequest)
  const hasModelSpoken = transcript.some((t) => t.role === 'model' && t.text.trim().length > 0)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // The Guided Tour highlights the on-screen Canvas, so make sure the Overview is showing.
  const startTour = () => {
    navigate(`/muse/${muse.id}`)
    start('tour')
  }

  const isActive = status === 'listening' || status === 'speaking' || status === 'processing'

  // Auto-expand when a session becomes active
  useEffect(() => {
    if (isActive) setExpanded(true)
  }, [isActive])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript])

  // Expand when another part of the UI requests it (e.g. "Ask the Mentor" CTA)
  useEffect(() => {
    if (openRequested) {
      setExpanded(true)
      clearOpenRequest()
    }
  }, [openRequested, clearOpenRequest])

  const museName = muse.name.length > 22 ? 'this Muse' : muse.name

  // ── Collapsed strip ────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Open Mentor pane"
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(true)}
        className="w-12 shrink-0 border-l border-border bg-surface flex flex-col items-center py-5 gap-3 cursor-pointer hover:bg-cream-hover transition-colors select-none"
      >
        <span className="text-accent text-lg leading-none">🎙</span>
        <span
          className="text-[11px] font-semibold text-ink-muted tracking-widest uppercase"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Mentor
        </span>
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        )}
        {status === 'ended' && (
          <span className="w-2 h-2 rounded-full bg-success" />
        )}
      </div>
    )
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  return (
    <div className="w-[320px] shrink-0 border-l border-border bg-surface flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-accent leading-none">🎙</span>
          <span className="font-semibold text-ink text-sm">Mentor</span>
          {isActive && <StatusDot status={status} />}
        </div>
        <button
          onClick={() => setExpanded(false)}
          aria-label="Collapse mentor pane"
          className="text-ink-muted hover:text-ink transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-cream-hover text-base font-light"
        >
          ›
        </button>
      </div>

      {/* ── Idle ──────────────────────────────────────────────────────────── */}
      {status === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/40 to-accent/10 flex items-center justify-center text-2xl shadow-sm">
            🎙
          </div>
          <div>
            <p className="font-semibold text-ink text-sm">Your Mentor is ready</p>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed max-w-[230px]">
              Mentor will walk you through {museName} on the page — narrating each section, connecting ideas, and making it stick.
              Jump in anytime to ask a question.
            </p>
          </div>
          <button
            onClick={startTour}
            className="w-full py-2.5 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Walk me through {museName}
          </button>
          <button
            onClick={() => start('chat')}
            className="text-xs text-ink-secondary hover:text-accent transition-colors -mt-2"
          >
            or just chat
          </button>
          <p className="text-xs text-ink-muted -mt-1">Microphone access required</p>
        </div>
      )}

      {/* ── Connecting ────────────────────────────────────────────────────── */}
      {status === 'connecting' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center">
          <Spinner size="lg" />
          <p className="text-sm text-ink-secondary">Connecting to Mentor…</p>
        </div>
      )}

      {/* ── Active (listening / speaking / processing) ─────────────────── */}
      {isActive && (
        <>
          {/* Orb + status */}
          <div className="shrink-0 flex flex-col items-center gap-2 py-5">
            <CompactOrb status={status} />
            <p className="text-xs font-medium text-ink-secondary">{activeLabel(status, tourPhase, hasModelSpoken)}</p>
          </div>

          {/* Transcript */}
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-4 pb-2 space-y-2"
          >
            {transcript.length === 0 && (
              <p className="text-center text-ink-muted text-xs pt-6">
                Mentor is about to start…
              </p>
            )}
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs leading-relaxed rounded-lg px-3 py-2',
                  entry.role === 'user'
                    ? 'bg-accent/10 text-accent-text ml-6'
                    : 'bg-cream border border-border text-ink'
                )}
              >
                {entry.role === 'model' && (
                  <span className="block text-[10px] font-semibold text-ink-muted mb-0.5 uppercase tracking-wide">
                    Mentor
                  </span>
                )}
                {entry.text}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-base transition-all border shrink-0',
                isMuted
                  ? 'bg-error/10 border-error/30 text-error'
                  : 'bg-cream border-border text-ink-secondary hover:border-accent hover:text-accent'
              )}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button
              onClick={end}
              title="End session"
              aria-label="End voice session"
              className="flex-1 py-2 rounded-lg bg-error/10 text-error text-xs font-medium hover:bg-error/20 transition-colors border border-error/20"
            >
              End Session
            </button>
          </div>
        </>
      )}

      {/* ── Ended ─────────────────────────────────────────────────────────── */}
      {status === 'ended' && (
        <div className="flex-1 flex flex-col">
          <div className="flex flex-col items-center gap-3 px-5 pt-6 pb-4 text-center">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-lg">✓</div>
            <div>
              <p className="font-semibold text-ink text-sm">Session complete</p>
              {transcript.filter((t) => t.role === 'model').length > 0 && (
                <p className="text-xs text-ink-secondary mt-0.5">
                  {transcript.filter((t) => t.role === 'model').length} exchanges with Mentor
                </p>
              )}
            </div>
            <button
              onClick={startTour}
              className="w-full py-2 px-4 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              Continue learning
            </button>
          </div>

          {/* Transcript review */}
          {transcript.length > 0 && (
            <div
              ref={transcriptRef}
              className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 border-t border-border pt-3"
            >
              {transcript.map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    'text-xs leading-relaxed px-2 py-1 rounded',
                    entry.role === 'user' ? 'text-accent-text' : 'text-ink-secondary'
                  )}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-2xl">⚠️</p>
          <p className="text-xs text-error leading-relaxed max-w-[220px]">{error}</p>
          <button
            onClick={startTour}
            className="py-2 px-5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: VoiceStatus }) {
  return (
    <span
      className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'speaking' ? 'bg-accent animate-pulse' : 'bg-success'
      )}
    />
  )
}

function CompactOrb({ status }: { status: VoiceStatus }) {
  if (status === 'speaking') {
    return (
      <div className="relative w-14 h-14 rounded-full flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent/15 animate-ping" />
        <div
          className="absolute inset-2 rounded-full bg-accent/20 animate-ping"
          style={{ animationDelay: '150ms' }}
        />
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-hover shadow-md" />
      </div>
    )
  }
  if (status === 'listening') {
    return (
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/60 to-accent/20 shadow-sm animate-pulse" />
    )
  }
  // processing
  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center">
      <Spinner size="sm" />
    </div>
  )
}

function activeLabel(status: VoiceStatus, tourPhase: TourPhase, hasModelSpoken: boolean): string {
  if (status === 'speaking') return 'Mentor is explaining…'
  if (status === 'processing') return 'Thinking…'
  if (status === 'listening') {
    // During a tour, Gemini takes a few seconds to start each section — don't show the
    // "your turn" label in that gap (it's misleading; the Mentor is about to speak).
    if (tourPhase === 'touring') {
      return hasModelSpoken ? 'Mentor is moving on…' : 'Mentor is preparing your walkthrough…'
    }
    if (tourPhase === 'detour') return 'Listening — ask your question'
    return 'Listening — ask anything or just wait'
  }
  return ''
}
