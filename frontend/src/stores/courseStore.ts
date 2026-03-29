import { create } from 'zustand'

export interface CourseState {
  currentCourseId: string | null
  currentLessonId: string | null
  progress: number
  completedLessons: string[]

  setCourse: (courseId: string) => void
  setLesson: (lessonId: string) => void
  setProgress: (progress: number) => void
  completeLesson: (lessonId: string) => void
  resetCourse: () => void
}

const initialState = {
  currentCourseId: null,
  currentLessonId: null,
  progress: 0,
  completedLessons: [],
}

export const useCourseStore = create<CourseState>((set) => ({
  ...initialState,

  setCourse: (courseId) => set({ currentCourseId: courseId }),

  setLesson: (lessonId) => set({ currentLessonId: lessonId }),

  setProgress: (progress) => set({ progress }),

  completeLesson: (lessonId) =>
    set((state) => ({
      completedLessons: state.completedLessons.includes(lessonId)
        ? state.completedLessons
        : [...state.completedLessons, lessonId],
    })),

  resetCourse: () => set(initialState),
}))
