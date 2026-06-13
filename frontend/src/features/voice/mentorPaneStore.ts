import { create } from 'zustand'

interface MentorPaneStore {
  openRequested: boolean
  requestOpen: () => void
  clearOpenRequest: () => void
}

export const useMentorPaneStore = create<MentorPaneStore>((set) => ({
  openRequested: false,
  requestOpen: () => set({ openRequested: true }),
  clearOpenRequest: () => set({ openRequested: false }),
}))
