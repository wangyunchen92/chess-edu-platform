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
  /** Ordered list of puzzle IDs for "next puzzle" navigation */
  puzzleList: string[]

  setPuzzle: (id: string, fen: string, solution: string[]) => void
  advanceStep: () => void
  setStatus: (status: PuzzleState['status']) => void
  useHint: () => void
  incrementStreak: () => void
  resetStreak: () => void
  setDailyCompleted: (completed: boolean) => void
  resetPuzzle: () => void
  setPuzzleList: (ids: string[]) => void
  getNextPuzzleId: () => string | null
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
  puzzleList: [] as string[],
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

  setPuzzleList: (ids) => set({ puzzleList: ids }),

  getNextPuzzleId: (): string | null => {
    const state = usePuzzleStore.getState() as PuzzleState
    const { currentPuzzleId, puzzleList } = state
    if (!currentPuzzleId || puzzleList.length === 0) return null
    const idx = puzzleList.indexOf(currentPuzzleId)
    if (idx === -1 || idx >= puzzleList.length - 1) return null
    return puzzleList[idx + 1]
  },
}))
