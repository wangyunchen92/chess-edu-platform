/**
 * Frontend TypeScript types aligned with backend Pydantic schemas.
 * This is the single source of truth for API response types.
 */

// ── Common ──────────────────────────────────────────────────────

export interface APIResponse<T> {
  code: number
  message: string
  data: T
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ── Auth ────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  phone: string
  password: string
  nickname?: string
  invite_code: string
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
}

export interface TokenData {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserResponse {
  id: string
  username: string
  nickname: string
  avatar_url: string | null
  role: string
  status: string
  membership_tier: string
  membership_expires_at: string | null
  created_at: string
  last_login_at: string | null
  login_count: number
}

export interface LoginResponse {
  user: UserResponse
  tokens: TokenData
}

export interface TokenRefreshRequest {
  refresh_token: string
}

export interface TokenRefreshResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ── User ────────────────────────────────────────────────────────

export interface UserProfileResponse {
  display_name: string | null
  birth_year: number | null
  chess_experience: string | null
  assessment_done: boolean
  initial_rating: number | null
  preferred_time: number | null
  notification_enabled: boolean
  daily_remind_time: string | null
  theme: string | null
  sound_enabled: boolean
}

export interface UserRatingResponse {
  game_rating: number
  puzzle_rating: number
  rank_title: string
  rank_tier: number
  rank_region: string
  xp_total: number
  xp_today: number
  coins: number
}

export interface UserStreakResponse {
  login_streak: number
  login_streak_max: number
  train_streak: number
  train_streak_max: number
  last_login_date: string | null
  last_train_date: string | null
  total_train_days: number
}

export interface UserFullResponse {
  id: string
  username: string
  nickname: string
  avatar_url: string | null
  role: string
  status: string
  membership_tier: string
  membership_expires_at: string | null
  created_at: string
  last_login_at: string | null
  login_count: number
  profile: UserProfileResponse | null
  rating: UserRatingResponse | null
  streak: UserStreakResponse | null
}

export interface UpdateUserRequest {
  nickname?: string
  avatar_url?: string
}

export interface UpdateSettingsRequest {
  theme?: string
  sound_enabled?: boolean
  notification_enabled?: boolean
  daily_remind_time?: string
  preferred_time?: number
}

export interface GameStats {
  total_games: number
  wins: number
  losses: number
  draws: number
  win_rate: number
}

export interface PuzzleStats {
  total_solved: number
  accuracy: number
  puzzle_rating: number
}

export interface LearningStats {
  completed_lessons: number
  total_lessons: number
}

export interface AchievementBrief {
  id: string
  name: string
  icon_key: string
  achieved_at: string
}

export interface ProfileStatsResponse {
  game_stats: GameStats
  puzzle_stats: PuzzleStats
  learning_stats: LearningStats
  recent_achievements: AchievementBrief[]
}

// ── Assessment ──────────────────────────────────────────────────

export interface AssessmentOption {
  key: string
  label: string
  is_correct: boolean
}

export interface AssessmentQuestion {
  id: string
  question: string
  image_url: string | null
  options: AssessmentOption[]
  difficulty: string
}

export interface AssessmentQuestionsResponse {
  experience_level: string
  questions: AssessmentQuestion[]
}

export interface AnswerItem {
  question_id: string
  selected_key: string
}

export interface SubmitAssessmentRequest {
  experience_level: string
  answers: AnswerItem[]
}

export interface AssessmentResultResponse {
  initial_rating: number
  rank_title: string
  rank_tier: number
  correct_count: number
  total_count: number
  message: string
}

// ── Play ────────────────────────────────────────────────────────

export interface CharacterStats {
  games_played: number
  games_won: number
  games_lost: number
  games_drawn: number
}

export interface CharacterListItem {
  id: string
  slug: string
  name: string
  tier: string
  region: string
  avatar_key: string
  play_style: string
  play_style_params: Record<string, unknown>
  base_rating: number
  rating_range_min: number
  rating_range_max: number
  is_free: boolean
  sort_order: number
  is_unlocked: boolean
  unlock_condition: Record<string, unknown> | null
  unlock_story: string | null
  affinity: number
  affinity_level: string
  stats: CharacterStats | null
}

export interface CharacterDetail {
  id: string
  slug: string
  name: string
  tier: string
  region: string
  avatar_key: string
  personality: string
  play_style: string
  play_style_params: Record<string, unknown>
  base_rating: number
  rating_range_min: number
  rating_range_max: number
  engine_depth_min: number
  engine_depth_max: number
  mistake_rate: number
  is_free: boolean
  sort_order: number
  is_unlocked: boolean
  unlock_condition: Record<string, unknown> | null
  unlock_story: string | null
  affinity: number
  affinity_level: string
  stats: CharacterStats | null
}

// ── Character Unlock ───────────────────────────────────────────

export interface UnlockConditionItem {
  type: string
  label: string
  required: string | number
  current?: string | number
  met: boolean
}

export interface CheckUnlockResponse {
  character_id: string
  character_name: string
  is_unlocked: boolean
  conditions: UnlockConditionItem[]
}

export interface UnlockCharacterResponse {
  character_id: string
  character_name?: string
  unlocked: boolean
  unlock_story?: Array<{ speaker: string; text: string; emotion?: string }>
  missing_conditions?: Array<{ type: string; required: string | number; current?: string | number }>
}

// ── Diagnosis ──────────────────────────────────────────────────

export interface DiagnosisScores {
  opening: number
  middlegame_tactics: number
  middlegame_strategy: number
  endgame: number
  time_management: number
}

export interface ThemeScoreItem {
  score: number
  correct: number
  total: number
}

export interface DiagnosisProfileResponse {
  user_id?: string
  confidence: string
  scores: DiagnosisScores | null
  theme_scores: Record<string, ThemeScoreItem> | null
  weakest_dimensions: string[] | null
  games_analyzed: number
  puzzles_analyzed: number
  min_games_required?: number
  min_puzzles_required?: number
  last_analyzed_at: string | null
  message?: string
}

export interface DiagnosisAnalyzeRequest {
  force?: boolean
}

export interface DiagnosisAnalyzeResponse {
  analyzed: boolean
  games_analyzed: number
  puzzles_analyzed: number
  changes: Array<{
    dimension: string
    old_score: number
    new_score: number
    trend: string
  }>
}

export interface RecommendationItem {
  id: string
  weakness_dimension: string
  recommendation_type: string
  target_id: string | null
  target_label: string
  priority: number
  status: string
  reason?: string
}

export interface DiagnosisSummaryResponse {
  has_diagnosis: boolean
  confidence: string
  primary_weakness: {
    dimension: string
    label: string
    score: number
    suggestion: string
  } | null
  active_recommendations_count: number
}

export interface CreateGameRequest {
  character_id: string
  time_control: number
}

export interface CreateGameResponse {
  game_id: string
}

export interface CompleteGameRequest {
  result: string
  pgn?: string
  moves_count?: number
  user_color?: string
  final_fen?: string
}

export interface GameListItem {
  id: string
  character_id: string
  character_name: string | null
  character_avatar_key: string | null
  user_color: string
  time_control: number
  status: string
  result: string | null
  total_moves: number | null
  rating_change: number | null
  user_rating_before: number | null
  user_rating_after: number | null
  started_at: string
  ended_at: string | null
  game_type?: string
  opponent_name?: string | null
}

export interface GameDetail {
  id: string
  user_id: string
  character_id: string
  character_name: string | null
  character_avatar_key: string | null
  user_color: string
  time_control: number
  time_increment: number
  status: string
  result: string | null
  result_reason: string | null
  pgn: string | null
  final_fen: string | null
  total_moves: number | null
  user_rating_before: number | null
  user_rating_after: number | null
  rating_change: number | null
  ai_rating_used: number | null
  hints_used: number
  review_data: Record<string, unknown> | null
  difficulty_mode: string | null
  adaptive_params: Record<string, unknown> | null
  started_at: string
  ended_at: string | null
  created_at: string
  game_type?: string
  opponent_name?: string | null
}

export interface GameReviewResponse {
  game_id: string
  review_data: Record<string, unknown> | null
}

export interface CreateFreeGameRequest {
  game_type: 'free_play' | 'imported'
  opponent_name?: string
  user_color?: string
  time_control?: number
  pgn?: string
  initial_fen?: string
}

export interface SavePositionRequest {
  fen: string
  title?: string
  notes?: string
}

export interface SavePositionResponse {
  game_id: string
  fen: string
}

// ── Puzzles ─────────────────────────────────────────────────────

export interface PuzzleItem {
  id: string
  puzzle_code: string
  fen: string
  solution_moves: string
  difficulty_level: number
  rating: number
  themes: string | null
  description: string | null
  hint_text: string | null
  explanation: string | null
  side_to_move: string
  move_count: number
}

export interface PuzzleAttemptRequest {
  user_moves: string
  is_correct: boolean
  time_spent_ms?: number
  hint_used?: boolean
  source?: string
}

export interface PuzzleAttemptResponse {
  is_correct: boolean
  puzzle_rating: number
  rating_before: number
  rating_after: number
  rating_change: number
  xp_earned: number
}

export interface DailyPuzzleItem {
  puzzle: PuzzleItem
  sort_order: number
  attempted: boolean
  is_correct: boolean | null
}

export interface DailyPuzzlesResponse {
  date: string
  puzzles: DailyPuzzleItem[]
  quota: Record<string, unknown>
}

export interface ChallengeLevelProgress {
  level: number
  total_puzzles: number
  solved_puzzles: number
  progress_pct: number
}

export interface ChallengeProgressResponse {
  levels: ChallengeLevelProgress[]
}

export interface MistakeItem {
  attempt_id: string
  puzzle: PuzzleItem
  user_moves: string
  attempted_at: string
}

export interface MistakeListResponse {
  mistakes: MistakeItem[]
  total: number
}

export interface PuzzleStatsResponse {
  puzzle_rating: number
  total_attempted: number
  total_correct: number
  accuracy_pct: number
  daily_attempted_today: number
  challenge_progress: ChallengeLevelProgress[]
}

export interface ThemeItem {
  theme: string
  name: string
  category: string
  count: number
  attempted: number
  correct: number
  accuracy: number
}

// ── Learn ───────────────────────────────────────────────────────

export interface LessonBrief {
  id: string
  slug: string
  title: string
  unit_name: string | null
  unit_order: number
  lesson_order: number
  content_type: string
  estimated_minutes: number | null
  xp_reward: number
  status: string
  progress_pct: number
}

export interface CourseListItem {
  id: string
  slug: string
  title: string
  description: string | null
  level: number
  total_lessons: number
  is_free: boolean
  membership_required: string | null
  sort_order: number
  completed_lessons: number
  progress_pct: number
}

export interface CourseDetail {
  id: string
  slug: string
  title: string
  description: string | null
  level: number
  total_lessons: number
  is_free: boolean
  membership_required: string | null
  completed_lessons: number
  progress_pct: number
  lessons: LessonBrief[]
}

export interface LessonContent {
  id: string
  slug: string
  title: string
  course_id: string
  course_title: string
  unit_name: string | null
  lesson_order: number
  content_type: string
  content_data: Record<string, unknown>
  ai_teaching_prompt: string | null
  estimated_minutes: number | null
  xp_reward: number
  status: string
  progress_pct: number
}

export interface UpdateProgressRequest {
  progress_pct: number
  last_position?: Record<string, unknown> | null
}

export interface UpdateProgressResponse {
  lesson_id: string
  status: string
  progress_pct: number
  xp_earned: number
  completed: boolean
}

export interface ExerciseItem {
  id: string
  exercise_order: number
  exercise_type: string
  question_text: string
  fen: string | null
  options: Record<string, unknown> | null
  attempted: boolean
  is_correct: boolean | null
}

export interface ExerciseAttemptRequest {
  user_answer: string
  time_spent_ms?: number
}

export interface ExerciseAttemptResponse {
  is_correct: boolean
  correct_answer: string
  explanation: string | null
  xp_earned: number
}

// ── Exercise Overview ──────────────────────────────────────────

export interface ExerciseOverviewLesson {
  lesson_id: string
  lesson_title: string
  course_id: string
  course_title: string
  level: number
  total_exercises: number
  completed_exercises: number
  correct_count: number
  status: 'not_started' | 'in_progress' | 'completed'
  lesson_learned: boolean
}

export interface ExerciseOverviewSummary {
  total_exercises: number
  completed_exercises: number
  accuracy_pct: number
}

export interface ExerciseOverviewResponse {
  summary: ExerciseOverviewSummary
  lessons: ExerciseOverviewLesson[]
}

export interface AITeachRequest {
  message: string
  context?: Record<string, unknown>
}

export interface AITeachResponse {
  reply: string
  board_fen: string | null
  suggested_moves: string[] | null
}

// ── Train ───────────────────────────────────────────────────────

export interface TrainPlanItem {
  index: number
  item_type: string
  title: string
  description: string
  estimated_minutes: number
  is_completed: boolean
  link: string | null
}

export interface TodayPlanResponse {
  plan_id: string
  plan_date: string
  template_type: string
  items: TrainPlanItem[]
  total_items: number
  completed_items: number
  is_completed: boolean
  total_minutes: number
  xp_earned: number
}

export interface CompletePlanItemResponse {
  item_index: number
  is_completed: boolean
  plan_completed: boolean
  xp_earned: number
}

export interface TrainStatsResponse {
  train_streak: number
  train_streak_max: number
  total_train_days: number
  this_week_completed: number
  this_week_total: number
  today_completed: boolean
}

export interface StreakResponse {
  login_streak: number
  login_streak_max: number
  train_streak: number
  train_streak_max: number
  total_train_days: number
  last_train_date: string | null
}

// ── Gamification ────────────────────────────────────────────────

export interface AchievementItem {
  id: string
  slug: string
  name: string
  description: string
  icon_key: string
  category: string
  condition_type: string
  condition_value: number
  xp_reward: number
  coin_reward: number
  rarity: string
  achieved: boolean
  achieved_at: string | null
}

export interface AchievementsResponse {
  achievements: AchievementItem[]
  unlocked_count: number
  total_count: number
}

export interface XPResponse {
  xp_total: number
  xp_today: number
  level: number
  xp_to_next_level: number
  coins: number
}

export interface RankResponse {
  game_rating: number
  puzzle_rating: number
  rank_title: string
  rank_tier: number
  rank_region: string
  history: Record<string, unknown>[]
}

export interface CheckAchievementsResponse {
  newly_unlocked: AchievementItem[]
  xp_awarded: number
  coins_awarded: number
}

// ── Adventure ───────────────────────────────────────────────────

export interface ChallengeItem {
  id: string
  name: string
  type: string
  description: string
  reward_xp: number
  opponent_id: string | null
  is_completed: boolean
}

export interface RegionItem {
  id: string
  name: string
  description: string
  rating_range: number[]
  icon: string
  unlock_condition: Record<string, unknown>
  is_unlocked: boolean
  challenges_total: number
  challenges_completed: number
}

export interface RegionDetail {
  id: string
  name: string
  description: string
  rating_range: number[]
  icon: string
  unlock_condition: Record<string, unknown>
  is_unlocked: boolean
  challenges: ChallengeItem[]
}

export interface AdventureMapResponse {
  regions: RegionItem[]
  current_rating: number
  current_region: string
}

export interface StartChallengeRequest {}

export interface ChallengeRecord {
  id: string
  user_id: string
  challenge_id: string
  challenge_type: string
  target_rank: string
  status: string
  game_id: string | null
  quiz_score: number | null
  attempt_count: number
  passed_at: string | null
  created_at: string | null
}

export interface CompleteChallengeRequest {
  result: string
  game_id?: string
  quiz_answers?: Record<string, unknown>
  quiz_score?: number
}

// ── Teacher / Student Management ──────────────────────────────

export interface InviteCodeResponse {
  id: string
  code: string
  max_uses: number
  used_count: number
  status: string
  expires_at: string
  created_at: string
}

export interface StudentSummary {
  total_games: number
  win_rate: number
  total_puzzles: number
  puzzle_accuracy: number
  course_completion: number
  game_rating: number
  puzzle_rating: number
  rank_title: string
  last_active_at: string | null
}

export interface TeacherStudentItem {
  student_id: string
  username: string
  nickname: string
  avatar_url: string | null
  bindtime: string
  summary: StudentSummary
}

export interface StudentDetailProfile {
  birth_year: number | null
  chess_experience: string | null
  assessment_done: boolean
  initial_rating: number | null
}

export interface StudentDetailRatings {
  game_rating: number
  puzzle_rating: number
  rank_title: string
  rank_tier: number
  rank_region: string
  xp_total: number
  coins: number
}

export interface StudentRecentGame {
  id: string
  character_name: string
  result: string
  rating_change: number
  played_at: string
}

export interface StudentGameStats {
  total_games: number
  wins: number
  losses: number
  draws: number
  win_rate: number
  recent_games: StudentRecentGame[]
}

export interface StudentPuzzleStats {
  total_attempts: number
  correct_count: number
  accuracy: number
  current_streak: number
}

export interface StudentCourseItem {
  course_id: string
  title: string
  total_lessons: number
  completed: number
  progress: number
}

export interface StudentCourseStats {
  total_lessons: number
  completed_lessons: number
  completion_rate: number
  courses: StudentCourseItem[]
}

export interface StudentStreak {
  current_login_streak: number
  max_login_streak: number
  current_train_streak: number
}

export interface StudentDetailResponse {
  student_id: string
  username: string
  nickname: string
  avatar_url: string | null
  bindtime: string
  profile: StudentDetailProfile
  ratings: StudentDetailRatings
  game_stats: StudentGameStats
  puzzle_stats: StudentPuzzleStats
  course_stats: StudentCourseStats
  streak: StudentStreak
  last_active_at: string | null
}

export interface JoinTeacherRequest {
  invite_code: string
}

export interface JoinTeacherResponse {
  teacher_id: string
  teacher_nickname: string
  bindtime: string
}

export interface MyTeacherItem {
  teacher_id: string
  teacher_nickname: string
  teacher_avatar_url: string | null
  bindtime: string
}

// ── Dashboard ───────────────────────────────────────────────────

export interface DashboardTrainProgress {
  total_items: number
  completed_items: number
  is_completed: boolean
}

export interface DashboardRating {
  game_rating: number
  puzzle_rating: number
  rank_title: string
  rank_region: string
}

export interface DashboardRecentGame {
  game_id: string
  character_name: string | null
  result: string | null
  rating_change: number | null
}

export interface DashboardResponse {
  train_progress: DashboardTrainProgress | null
  rating: DashboardRating
  xp_today: number
  xp_total: number
  level: number
  streak: number
  recent_games: DashboardRecentGame[]
  daily_puzzles_remaining: number
  unread_notifications: number
}

// ── Notifications ───────────────────────────────────────────────

export interface NotificationItem {
  id: string
  type: string
  title: string
  content: string
  is_read: boolean
  extra_data: Record<string, unknown> | null
  created_at: string
}

export interface NotificationListResponse {
  notifications: NotificationItem[]
  unread_count: number
  total: number
}

// ── Credits ────────────────────────────────────────────────────

export interface CreditBalanceResponse {
  balance: number
  total_earned: number
  total_spent: number
}

export interface CreditTransactionItem {
  id: string
  amount: number
  balance_after: number
  type: string
  description: string
  created_at: string
}

export interface CreditPackageItem {
  id: string
  name: string
  credits: number
  price_cents: number
}
