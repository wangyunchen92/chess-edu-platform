import { create } from 'zustand'

export interface PuzzleState {
  currentPuzzleId: string | null
  fen: string
  solution: string[]
  currentStep: number
  status: 'idle' | 'solving' | 'solved' | 'failed'
  hintsUsed: number
  streak: number
  dailyCompleted: boolean

  setPuzzle: (id: string, fen: string, solution: string[]) => void
  advanceStep: () => void
  setStatus: (status: PuzzleState['status']) => void
  useHint: () => void
  incrementStreak: () => void
  resetStreak: () => void
  setDailyCompleted: (completed: boolean) => void
  resetPuzzle: () => void
}

const initialState = {
  currentPuzzleId: null,
  fen: '',
  solution: [],
  currentStep: 0,
  status: 'idle' as const,
  hintsUsed: 0,
  streak: 0,
  dailyCompleted: false,
}

export const usePuzzleStore = create<PuzzleState>((set) => ({
  ...initialState,

  setPuzzle: (id, fen, solution) =>
    set({ currentPuzzleId: id, fen, solution, currentStep: 0, status: 'solving', hintsUsed: 0 }),

  advanceStep: () =>
    set((state) => ({ currentStep: state.currentStep + 1 })),

  setStatus: (status) => set({ status }),

  useHint: () =>
    set((state) => ({ hintsUsed: state.hintsUsed + 1 })),

  incrementStreak: () =>
    set((state) => ({ streak: state.streak + 1 })),

  resetStreak: () => set({ streak: 0 }),

  setDailyCompleted: (completed) => set({ dailyCompleted: completed }),

  resetPuzzle: () => set(initialState),
}))
