import { create } from 'zustand'

export interface GameState {
  gameId: string | null
  fen: string
  moves: string[]
  playerColor: 'white' | 'black'
  status: 'idle' | 'playing' | 'paused' | 'finished'
  result: 'win' | 'loss' | 'draw' | null
  timeWhite: number
  timeBlack: number
  opponentId: string | null
  opponentName: string | null

  setGame: (gameId: string, playerColor: 'white' | 'black') => void
  updateFen: (fen: string) => void
  addMove: (move: string) => void
  setStatus: (status: GameState['status']) => void
  setResult: (result: GameState['result']) => void
  setTime: (white: number, black: number) => void
  resetGame: () => void
}

const initialState = {
  gameId: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: [],
  playerColor: 'white' as const,
  status: 'idle' as const,
  result: null,
  timeWhite: 600,
  timeBlack: 600,
  opponentId: null,
  opponentName: null,
}

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setGame: (gameId, playerColor) =>
    set({ ...initialState, gameId, playerColor, status: 'playing' }),

  updateFen: (fen) => set({ fen }),

  addMove: (move) =>
    set((state) => ({ moves: [...state.moves, move] })),

  setStatus: (status) => set({ status }),

  setResult: (result) => set({ result, status: 'finished' }),

  setTime: (white, black) => set({ timeWhite: white, timeBlack: black }),

  resetGame: () => set(initialState),
}))
