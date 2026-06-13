const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                    => request<T>(path),
  post:   <T>(path: string, body: unknown)     => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)     => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                    => request<T>(path, { method: 'DELETE' }),

  /** Multipart file upload — do NOT set Content-Type, browser sets it with boundary. */
  upload<T>(path: string, formData: FormData): Promise<T> {
    return fetch(`${BASE}${path}`, { method: 'POST', body: formData }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`${res.status}: ${text}`)
      }
      return res.json() as Promise<T>
    })
  },

  /** Server-Sent Events streaming (for chat responses). */
  stream(
    path: string,
    body: unknown,
    onChunk: (chunk: string) => void,
    onDone?: () => void,
    onError?: (err: Error) => void
  ): () => void {
    const controller = new AbortController()
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          throw new Error(`${res.status}: ${text}`)
        }
        const reader = res.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          onChunk(decoder.decode(value, { stream: true }))
        }
        onDone?.()
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        onError?.(err instanceof Error ? err : new Error(String(err)))
      })
    return () => controller.abort()
  },
}

// ── Types shared between frontend and backend ────────────────────────────────

export interface Muse {
  id: string
  name: string
  description: string
  knowledge_level: string
  cover_emoji: string | null
  status: string
  agent_status: string
  resource_count: number
  research_focus: string | null
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  muse_id: string
  title: string
  source_type: string
  source_url: string | null
  summary: string | null
  key_concepts: string[]
  origin: string
  approved: boolean
  status: string
  created_at: string
}

export interface KnowledgeLayer {
  muse_id: string
  synthesis: string
  glossary: { term: string; definition: string }[]
  gaps: string[]
  status: 'idle' | 'building' | 'ready' | 'failed'
  error: string | null
  resource_count: number
  built_at: string | null
}

export type CanvasSectionType =
  | 'hero'
  | 'prose'
  | 'key_concepts'
  | 'timeline'
  | 'comparison'
  | 'stat_band'
  | 'resource_spotlight'
  | 'gaps'
  | 'takeaways'

export interface CanvasSection {
  id: string
  type: CanvasSectionType
  title: string
  narration: string
  // Shape depends on `type` — see backend services/canvas/prompts.py SECTION_SCHEMAS
  data: Record<string, unknown>
  order: number
}

export interface MuseCanvas {
  muse_id: string
  sections: CanvasSection[]
  status: 'idle' | 'building' | 'ready' | 'stale' | 'failed'
  error: string | null
  source_signature: string
  built_at: string | null
  stale: boolean
}

export interface BackgroundJob {
  id: string
  muse_id: string
  job_type: string
  status: string
  progress: number
  status_message: string
  error: string | null
  created_at: string
  completed_at: string | null
}

export interface LessonProgress {
  id: string
  lesson_id: string
  status: 'not_started' | 'in_progress' | 'complete'
  quiz_score: number | null
  completed_at: string | null
}

export interface Lesson {
  id: string
  muse_id: string
  order: number
  title: string
  summary: string
  key_concepts: string[]
  created_at: string
  progress: LessonProgress | null
}

export interface QuizQuestion {
  question: string
  type: 'multiple_choice' | 'true_false' | 'short_answer'
  options: string[]
  correct_answer: string
  explanation: string
}

export interface LessonDetail extends Lesson {
  content: string
  quiz_questions: QuizQuestion[]
}

export interface GenerationJob {
  id: string
  status: string
  progress: number
  status_message: string
}

export interface Citation {
  resource_id: string
  resource_title: string
  excerpt: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  created_at: string
}

export interface ChatSession {
  id: string
  muse_id: string
  title: string | null
  created_at: string
  messages?: ChatMessage[]
}
