import { create } from 'zustand'

export interface TrainTask {
  id: string
  type: 'puzzle' | 'lesson' | 'game' | 'review'
  title: string
  completed: boolean
}

export interface TrainState {
  dailyTasks: TrainTask[]
  xpToday: number
  xpTarget: number
  streakDays: number

  setDailyTasks: (tasks: TrainTask[]) => void
  completeTask: (taskId: string) => void
  addXP: (amount: number) => void
  setStreak: (days: number) => void
  resetDaily: () => void
}

const initialState = {
  dailyTasks: [],
  xpToday: 0,
  xpTarget: 100,
  streakDays: 0,
}

export const useTrainStore = create<TrainState>((set) => ({
  ...initialState,

  setDailyTasks: (tasks) => set({ dailyTasks: tasks }),

  completeTask: (taskId) =>
    set((state) => ({
      dailyTasks: state.dailyTasks.map((t) =>
        t.id === taskId ? { ...t, completed: true } : t
      ),
    })),

  addXP: (amount) =>
    set((state) => ({ xpToday: state.xpToday + amount })),

  setStreak: (days) => set({ streakDays: days }),

  resetDaily: () => set({ dailyTasks: [], xpToday: 0 }),
}))
