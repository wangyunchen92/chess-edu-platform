/**
 * Lesson block types for the interactive classroom UI.
 * Extends the legacy step format with character-driven dialogue blocks.
 */

// ── Block Types ────────────────────────────────────────────────────

export type BlockType = 'dialogue' | 'board_demo' | 'interactive' | 'quiz' | 'story' | 'celebration'

export type CharacterExpression = 'idle' | 'happy' | 'thinking' | 'celebrate' | 'encourage' | 'surprised'

export interface DialogueBlock {
  type: 'dialogue'
  character: string
  expression: CharacterExpression
  content: string
}

export interface BoardDemoBlock {
  type: 'board_demo'
  fen: string
  description?: string
  highlights?: string[]
  character?: string
  expression?: CharacterExpression
}

export interface InteractiveBlock {
  type: 'interactive'
  fen: string
  instruction: string
  expectedMove: string
  successMessage?: string
  character?: string
  expression?: CharacterExpression
}

export interface QuizBlock {
  type: 'quiz'
  question: string
  options: string[]
  correctIndex: number
  character?: string
  expression?: CharacterExpression
}

export interface StoryBlock {
  type: 'story'
  content: string
  imageHint?: string
  character?: string
  expression?: CharacterExpression
}

export interface CelebrationBlock {
  type: 'celebration'
  xpEarned: number
  message: string
}

export type LessonBlock =
  | DialogueBlock
  | BoardDemoBlock
  | InteractiveBlock
  | QuizBlock
  | StoryBlock
  | CelebrationBlock

// ── Lesson Data ────────────────────────────────────────────────────

export interface LessonData {
  id: string
  title: string
  courseId: string
  lessonOrder: number
  blocks: LessonBlock[]
  nextLessonId?: string
  exerciseId?: string
  xpReward: number
}

// ── Theme ──────────────────────────────────────────────────────────

export interface LessonTheme {
  bg: string
  accent: string
  name: string
}

export const LESSON_THEMES: LessonTheme[] = [
  { bg: 'from-blue-50 to-indigo-100', accent: '#6366f1', name: '星空蓝' },
  { bg: 'from-emerald-50 to-green-100', accent: '#10b981', name: '森林绿' },
  { bg: 'from-amber-50 to-orange-100', accent: '#f59e0b', name: '阳光橙' },
  { bg: 'from-pink-50 to-rose-100', accent: '#ec4899', name: '樱花粉' },
  { bg: 'from-cyan-50 to-teal-100', accent: '#06b6d4', name: '海洋青' },
  { bg: 'from-violet-50 to-purple-100', accent: '#8b5cf6', name: '魔法紫' },
]

export function getLessonTheme(lessonOrder: number): LessonTheme {
  return LESSON_THEMES[lessonOrder % LESSON_THEMES.length]
}

// ── Character Definitions ──────────────────────────────────────────

export interface CharacterDef {
  id: string
  name: string
  role: 'teacher' | 'student'
  color: string
  expressions: Record<CharacterExpression, string>
}

export const CHARACTERS: Record<string, CharacterDef> = {
  douding: {
    id: 'douding',
    name: '豆丁老师',
    role: 'teacher',
    color: '#6366f1',
    expressions: {
      idle: '\uD83E\uDD14',       // 🤔
      happy: '\uD83D\uDE0A',      // 😊
      thinking: '\uD83E\uDDD0',   // 🧐
      celebrate: '\uD83C\uDF89',  // 🎉
      encourage: '\uD83D\uDCAA',  // 💪
      surprised: '\uD83D\uDE2E',  // 😮
    },
  },
  xiaoqi: {
    id: 'xiaoqi',
    name: '小琪',
    role: 'student',
    color: '#f59e0b',
    expressions: {
      idle: '\uD83D\uDE42',       // 🙂
      happy: '\uD83D\uDE04',      // 😄
      thinking: '\uD83E\uDD14',   // 🤔
      celebrate: '\uD83E\uDD29',  // 🤩
      encourage: '\uD83D\uDE0A',  // 😊
      surprised: '\uD83D\uDE32',  // 😲
    },
  },
}

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? CHARACTERS.douding
}

// ── Expression → Emoji Map (legacy, use getCharacter().expressions instead) ──

export const EXPRESSION_EMOJI: Record<CharacterExpression, string> = CHARACTERS.douding.expressions

// ── Legacy Block Mapping ───────────────────────────────────────────

/**
 * Convert a legacy step (from existing lesson JSON) to the new LessonBlock format.
 * If the step already has character/expression fields, those are preserved.
 */
export function mapLegacyBlock(step: Record<string, unknown>): LessonBlock {
  const type = step.type as string

  // Already new format — pass through
  if (type === 'dialogue' || type === 'story' || type === 'celebration') {
    return step as unknown as LessonBlock
  }

  // text → dialogue
  if (type === 'text') {
    return {
      type: 'dialogue',
      character: (step.character as string) ?? 'douding',
      expression: (step.expression as CharacterExpression) ?? 'idle',
      content: (step.content as string) ?? '',
    }
  }

  // image_text → story
  if (type === 'image_text') {
    return {
      type: 'story',
      content: (step.content as string) ?? '',
      imageHint: (step.imageHint as string) ?? (step.image_hint as string) ?? undefined,
      character: (step.character as string) ?? 'douding',
      expression: (step.expression as CharacterExpression) ?? 'idle',
    }
  }

  // board_demo — keep structure, ensure type
  if (type === 'board_demo') {
    return {
      type: 'board_demo',
      fen: (step.fen as string) ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      description: (step.description as string) ?? undefined,
      highlights: (step.highlights as string[]) ?? undefined,
      character: (step.character as string) ?? 'douding',
      expression: (step.expression as CharacterExpression) ?? 'happy',
    }
  }

  // interactive
  if (type === 'interactive') {
    let expectedMove = (step.expectedMove as string) ?? ''
    if (!expectedMove && step.correct_squares && Array.isArray(step.correct_squares) && (step.correct_squares as string[]).length > 0) {
      expectedMove = (step.correct_squares as string[]).join(',')
    }
    return {
      type: 'interactive',
      fen: (step.fen as string) ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      instruction: (step.instruction as string) ?? '',
      expectedMove,
      successMessage: (step.successMessage as string) ?? (step.hint as string) ?? undefined,
      character: (step.character as string) ?? 'douding',
      expression: (step.expression as CharacterExpression) ?? 'thinking',
    }
  }

  // quiz
  if (type === 'quiz') {
    return {
      type: 'quiz',
      question: (step.question as string) ?? '',
      options: (step.options as string[]) ?? [],
      correctIndex: (step.correctIndex as number) ?? (step.correct as number) ?? (step.correct_answer as number) ?? 0,
      character: (step.character as string) ?? 'douding',
      expression: (step.expression as CharacterExpression) ?? 'thinking',
    }
  }

  // Fallback: treat unknown as dialogue
  return {
    type: 'dialogue',
    character: (step.character as string) ?? 'douding',
    expression: (step.expression as CharacterExpression) ?? 'idle',
    content: (step.content as string) ?? JSON.stringify(step),
  }
}
