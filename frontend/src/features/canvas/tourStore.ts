import { create } from 'zustand'

export type TourPhase = 'idle' | 'intro' | 'touring' | 'detour' | 'complete'

interface TourState {
  /** Anchor id(s) the Mentor is currently narrating (drives highlight + scroll). A stop
   *  may target a whole block ("b2") or a single element ("b2.c1"). */
  activeAnchorIds: string[]
  tourPhase: TourPhase
  /** Command bus: an "Explain this" request from the Canvas, consumed by useVoiceSession.
   *  If a session is live it becomes an explain_anchor turn; otherwise it starts a tour
   *  positioned at that anchor. */
  pendingExplain: { anchorId: string; selectedText?: string; ts: number } | null
  setActiveAnchors: (ids: string[]) => void
  setTourPhase: (phase: TourPhase) => void
  requestExplain: (anchorId: string, selectedText?: string) => void
  clearExplain: () => void
  reset: () => void
}

/**
 * Shared client state bridging the MentorPane (writes anchors/phase, consumes jumps via
 * useVoiceSession) and the Canvas (reads anchors/phase, requests jumps). Module-level
 * Zustand store so the two sibling components stay in sync without prop drilling (PRD §7.5).
 * Server data stays in react-query — this holds UI/control state only.
 */
export const useTourStore = create<TourState>((set) => ({
  activeAnchorIds: [],
  tourPhase: 'idle',
  pendingExplain: null,
  setActiveAnchors: (ids) => set({ activeAnchorIds: ids }),
  setTourPhase: (phase) => set({ tourPhase: phase }),
  requestExplain: (anchorId, selectedText) => set({ pendingExplain: { anchorId, selectedText, ts: Date.now() } }),
  clearExplain: () => set({ pendingExplain: null }),
  reset: () => set({ activeAnchorIds: [], tourPhase: 'idle', pendingExplain: null }),
}))
