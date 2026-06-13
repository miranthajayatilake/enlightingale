import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'processing'
  | 'error'
  | 'ended'

export interface TranscriptEntry {
  role: 'user' | 'model'
  text: string
}

export interface VoiceSession {
  status: VoiceStatus
  transcript: TranscriptEntry[]
  isMuted: boolean
  error: string | null
  start: () => Promise<void>
  end: () => void
  toggleMute: () => void
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function useVoiceSession(museId: string): VoiceSession {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsRef               = useRef<WebSocket | null>(null)
  const audioCtxRef         = useRef<AudioContext | null>(null)
  const streamRef           = useRef<MediaStream | null>(null)
  const nextPlayRef         = useRef<number>(0)
  const audioSourcesRef     = useRef<AudioBufferSourceNode[]>([])
  const isMutedRef          = useRef(false)
  const sessionIdRef        = useRef<string | null>(null)
  // Incremented each time start() is called so stale session callbacks are ignored
  const generationRef       = useRef(0)
  const flushIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Per-turn transcript pacing. The text for a model turn is revealed in proportion to
  // how far the audio playback head has advanced through that turn — immune to how deep
  // the audio buffer is (Gemini streams audio faster than real time).
  const turnActiveRef     = useRef(false)  // a model speech turn is in progress
  const turnNeedsAnchorRef = useRef(false) // turn started; waiting for first audio to set its start time
  const turnStartTimeRef  = useRef(0)      // AudioContext time the turn's audio begins
  const turnTextRef       = useRef('')     // full transcript text received for this turn
  const revealedCharsRef  = useRef(0)      // how many chars of turnText are already shown

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // Reveal model transcript paced to the voice: show the prefix of the turn's text whose
  // length matches the fraction of the turn's audio that has already played.
  const flushReadyTranscript = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    // Wait until the turn's audio start time is anchored (set by its first audio chunk),
    // otherwise pacing would use a stale start time and dump text early.
    if (turnNeedsAnchorRef.current) return
    const total = turnTextRef.current.length
    if (total <= revealedCharsRef.current) return

    const span = nextPlayRef.current - turnStartTimeRef.current
    const LEAD = 0.3 // show text a hair before the voice reaches it
    let fraction = span > 0.05 ? (ctx.currentTime - turnStartTimeRef.current + LEAD) / span : 1
    fraction = Math.min(1, Math.max(0, fraction))

    const target = Math.floor(fraction * total)
    if (target <= revealedCharsRef.current) return
    revealedCharsRef.current = target

    const prefix = turnTextRef.current.slice(0, target)
    setTranscript((t) => {
      const next = [...t]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'model') {
          next[i] = { role: 'model', text: prefix }
          return next
        }
      }
      return next
    })
  }, [])

  const resetTurn = useCallback(() => {
    turnActiveRef.current = false
    turnNeedsAnchorRef.current = false
    turnTextRef.current = ''
    revealedCharsRef.current = 0
  }, [])

  // Open a fresh model turn: clear its text buffer and add an empty bubble to fill.
  const beginTurn = useCallback(() => {
    turnActiveRef.current = true
    turnNeedsAnchorRef.current = true
    turnTextRef.current = ''
    revealedCharsRef.current = 0
    setTranscript((t) => [...t, { role: 'model', text: '' }])
  }, [])

  const stopAllAudio = useCallback(() => {
    audioSourcesRef.current.forEach((s) => { try { s.stop() } catch { /* already stopped */ } })
    audioSourcesRef.current = []
    if (audioCtxRef.current) {
      nextPlayRef.current = audioCtxRef.current.currentTime
    }
    // The remaining (unrevealed) text's audio was just stopped, so drop it.
    resetTurn()
  }, [resetTurn])

  const cleanup = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current)
      flushIntervalRef.current = null
    }
    stopAllAudio()
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [stopAllAudio])

  const playPCM24k = useCallback((buffer: ArrayBuffer) => {
    const ctx = audioCtxRef.current
    if (!ctx) return

    const int16 = new Int16Array(buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
    audioBuffer.copyToChannel(float32, 0)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    const startAt = Math.max(ctx.currentTime + 0.02, nextPlayRef.current)

    // Anchor the turn's transcript pacing to the play time of its first audio chunk.
    // beginTurn is normally called on the 'speaking' state; this is a fallback for audio
    // that arrives without a preceding state message.
    if (!turnActiveRef.current) beginTurn()
    if (turnNeedsAnchorRef.current) {
      turnNeedsAnchorRef.current = false
      turnStartTimeRef.current = startAt
    }

    source.start(startAt)
    nextPlayRef.current = startAt + audioBuffer.duration

    audioSourcesRef.current.push(source)
    source.onended = () => {
      audioSourcesRef.current = audioSourcesRef.current.filter((s) => s !== source)
    }
  }, [beginTurn])

  const handleMessage = useCallback(
    (msg: { type: string; value?: string; role?: string; text?: string; data?: string; message?: string }) => {
      switch (msg.type) {
        case 'ready':
          setStatus('listening')
          break

        case 'state':
          if (msg.value === 'listening' || msg.value === 'speaking' || msg.value === 'processing') {
            setStatus(msg.value)
          }
          // New speech turn begins — reset its text buffer before any transcript arrives.
          if (msg.value === 'speaking' && !turnActiveRef.current) {
            beginTurn()
          }
          // Turn finished generating. Mark it closed so the next 'speaking' opens a new
          // turn — but leave turnText/reveal intact so the flush loop keeps pacing the
          // already-buffered audio that is still playing out.
          if (msg.value === 'listening') {
            turnActiveRef.current = false
          }
          break

        case 'audio_chunk':
          if (msg.data) {
            playPCM24k(fromBase64(msg.data))
          }
          break

        case 'transcript': {
          if (msg.text && (msg.role === 'user' || msg.role === 'model')) {
            const role = msg.role as 'user' | 'model'
            const text = msg.text
            const ctx = audioCtxRef.current

            if (role === 'model' && ctx) {
              // Open the turn if text arrives before its first audio chunk, so a later
              // beginTurn (on the 'speaking' state) can't wipe these opening words.
              if (!turnActiveRef.current) beginTurn()
              // Accumulate into the current turn; the flush loop reveals it paced to audio.
              turnTextRef.current += text
            } else {
              // User transcript shows immediately
              setTranscript((t) => {
                const last = t[t.length - 1]
                if (last && last.role === 'user') {
                  return [...t.slice(0, -1), { role: 'user', text: last.text + text }]
                }
                return [...t, { role: 'user', text }]
              })
            }
          }
          break
        }

        case 'interrupted':
          stopAllAudio()
          setStatus('listening')
          break

        case 'error':
          setError(msg.message ?? 'Unknown error')
          setStatus('error')
          cleanup()
          break
      }
    },
    [playPCM24k, stopAllAudio, cleanup, beginTurn]
  )

  const end = useCallback(() => {
    if (sessionIdRef.current) {
      api.post(`/muses/${museId}/voice/session/${sessionIdRef.current}/end`, {}).catch(() => {})
      sessionIdRef.current = null
    }
    cleanup()
    setStatus('ended')
  }, [cleanup, museId])

  const start = useCallback(async () => {
    // Tear down any existing session before creating a new one.
    // The generation counter ensures stale async callbacks (mic, ws events) are ignored.
    cleanup()
    const generation = ++generationRef.current

    setStatus('connecting')
    setError(null)
    setTranscript([])

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream

      const { session_id } = await api.post<{ session_id: string; ws_url: string }>(
        `/muses/${museId}/voice/session`,
        {}
      )
      if (generation !== generationRef.current) return
      sessionIdRef.current = session_id

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      nextPlayRef.current = audioCtx.currentTime
      resetTurn()
      flushIntervalRef.current = setInterval(flushReadyTranscript, 80)

      await audioCtx.audioWorklet.addModule('/pcm-processor.js')
      const micSource = audioCtx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor')
      micSource.connect(workletNode)

      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (isMutedRef.current) return
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'audio_chunk', data: toBase64(e.data) }))
        }
      }

      const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${wsProto}://${window.location.host}/ws/voice/${session_id}`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        // Drop events from a previous session that wasn't fully torn down yet
        if (generation !== generationRef.current) return
        try {
          handleMessage(JSON.parse(e.data as string))
        } catch { /* ignore malformed */ }
      }

      ws.onclose = () => {
        if (generation !== generationRef.current) return
        setStatus((prev) =>
          prev === 'connecting' || prev === 'listening' || prev === 'speaking' ? 'ended' : prev
        )
        cleanup()
      }

      ws.onerror = () => {
        if (generation !== generationRef.current) return
        setError('WebSocket connection failed')
        setStatus('error')
        cleanup()
      }
    } catch (err) {
      if (generation !== generationRef.current) return
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
      cleanup()
    }
  }, [museId, handleMessage, cleanup, flushReadyTranscript, resetTurn])

  useEffect(() => () => { cleanup() }, [cleanup])

  const toggleMute = useCallback(() => setIsMuted((m) => !m), [])

  return { status, transcript, isMuted, error, start, end, toggleMute }
}
