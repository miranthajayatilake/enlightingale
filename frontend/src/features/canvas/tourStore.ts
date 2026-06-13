import { create } from 'zustand'

export type TourPhase = 'idle' | 'touring' | 'detour' | 'complete'

interface TourState {
  /** Canvas section the Mentor is currently narrating (drives highlight + scroll). */
  activeSectionId: string | null
  tourPhase: TourPhase
  /** Command bus: a click-to-jump request from the Canvas, consumed by useVoiceSession. */
  pendingJump: { id: string; ts: number } | null
  setActiveSection: (id: string | null) => void
  setTourPhase: (phase: TourPhase) => void
  requestJump: (id: string) => void
  clearJump: () => void
  reset: () => void
}

/**
 * Shared client state bridging the MentorPane (writes section/phase, consumes jumps via
 * useVoiceSession) and the Canvas (reads section/phase, requests jumps). Module-level
 * Zustand store so the two sibling components stay in sync without prop drilling (PRD §7.5).
 * Server data stays in react-query — this holds UI/control state only.
 */
export const useTourStore = create<TourState>((set) => ({
  activeSectionId: null,
  tourPhase: 'idle',
  pendingJump: null,
  setActiveSection: (id) => set({ activeSectionId: id }),
  setTourPhase: (phase) => set({ tourPhase: phase }),
  requestJump: (id) => set({ pendingJump: { id, ts: Date.now() } }),
  clearJump: () => set({ pendingJump: null }),
  reset: () => set({ activeSectionId: null, tourPhase: 'idle', pendingJump: null }),
}))
