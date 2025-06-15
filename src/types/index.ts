/**
 * index
 * ----------------
 * TODO: Add description and exports for index.
 */

// Core Types for Ustaz AI Tutoring System
// This file centralizes all type definitions for better maintainability

// ============================================================
// CHAT TYPES
// ============================================================

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  hasGeneratedContent?: boolean
}

// ============================================================
// SUBJECT TYPES
// ============================================================

export interface Subject {
  id: string
  name: string
  progress: number
  color: string
  isActive: boolean
  startedAt: Date
  completedAt?: Date
  topicKeywords: string[]
  messageCount: number
  lastActive: Date
  lessonPlan?: {
    lessons: Array<{
      id: string
      title: string
      description: string
    }>
    currentLessonIndex: number
  }
}

// ============================================================
// INTERACTIVE COMPONENT TYPES
// ============================================================

export type ComponentType =
  | 'multiple-choice'
  | 'fill-blank'
  | 'drag-drop'
  | 'formula-explorer'
  | 'step-solver'
  | 'concept-card'
  | 'interactive-example'
  | 'progress-quiz'
  | 'graph-visualizer'
  | 'text-highlighter'
  | 'explainer'
  | 'placeholder'

// Shared interface for all interactive components
export interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
  isLoading?: boolean
}

// ============================================================
// LEARNING TYPES
// ============================================================

export interface LessonPlan {
  subject: string
  currentLessonIndex: number
  lessons: Lesson[]
}

export interface ConceptInfo {
  id: string
  name: string
  description?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  estimatedPracticeItems?: number
  relatedConcepts?: string[]
}

export interface Lesson {
  id: string
  title: string
  description: string
  completed?: boolean
  content?: LessonContent
  concepts?: ConceptInfo[]
  currentConceptIndex?: number
}

export interface LessonContent {
  type: ComponentType
  data: unknown
}

export interface LearningProgress {
  correctAnswers: number
  totalAttempts: number
  needsReview?: boolean
  readyForNext?: boolean
  currentLessonIndex?: number
  completedLessons?: number[]
  streakCount?: number
}

export interface ProgressCriteria {
  minCorrectAnswers: number
  minTotalAttempts: number
  minAccuracy: number
  adaptiveFactors: {
    difficultyAdjustment: number
    engagementWeight: number
    retentionFactor: number
  }
  reasoning?: string
}

export interface LessonInfo {
  current: number
  total: number
}

export interface ProgressInfo {
  correct: number
  total: number
  ready: boolean
}

// ============================================================
// PERSISTENCE TYPES
// ============================================================

export interface PersistedMessage {
  id: string
  user_id: string
  subject_id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  has_generated_content?: boolean
  created_at?: string
}

export interface PersistedContentItem {
  id: string
  user_id: string
  subject_id: string
  type: ComponentType
  data: Record<string, unknown>
  title: string
  order_index: number
  timestamp: string
  created_at?: string
}

export interface PersistedSubject {
  id: string
  user_id: string
  name: string
  keywords?: string[]
  lesson_plan?: unknown
  learning_progress?: unknown
  last_active: string
  created_at?: string
}

// ============================================================
// ERROR HANDLING TYPES
// ============================================================

export type ErrorType = 
  | 'network'
  | 'database'
  | 'permission'
  | 'validation'
  | 'unknown'

export interface AppError {
  type: ErrorType
  message: string
  userMessage: string
  originalError: unknown
  canRetry: boolean
  timestamp: Date
  operation?: string
}

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
}

// ============================================================
// UTILITY TYPES
// ============================================================

export type LogLevel = 'debug' | 'info' | 'error'

// ============================================================
// API TYPES
// ============================================================

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string
      role: string
    }
    finish_reason: string
  }>
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ============================================================
// AI SERVICE TYPES
// ============================================================

export interface CacheEntry {
  data: unknown
  timestamp: number
  type: string
}

export interface PlanStructureData {
  recommendedLessons: number
  complexity: 'beginner' | 'intermediate' | 'advanced'
  focusAreas: string[]
  learningObjectives: string[]
  estimatedHoursPerLesson: number
  prerequisites: string[]
  reasoning: string
}

export interface PlanDataStructure {
  subject: string
  lessons: Array<{
    id?: string
    title?: string
    description?: string
    concepts?: Array<{
      id?: string
      name?: string
      description?: string
      difficulty?: string
      estimatedPracticeItems?: number
    }>
  }>
}

// ============================================================
// HOOK TYPES
// ============================================================

export interface UseSubjectSessionProps {
  user?: { id: string } | null
  selectedSubject: Subject | null
  onMessagesLoaded?: (messages: Message[]) => void
}

export interface UsePendingMessagesProps {
  user?: { id: string } | null
  selectedSubject?: { id: string } | null
  onRetrySuccess?: (savedMessages: Message[]) => void
}

// ============================================================
// UI COMPONENT TYPES
// ============================================================

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullWidth?: boolean
  message?: string
  className?: string
  padding?: string
  fullScreen?: boolean
  text?: string
}

export interface ErrorAlertProps {
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  isVisible?: boolean
  isPersistent?: boolean
  autoClose?: boolean
  autoCloseDelay?: number
  className?: string
  retryText?: string
  dismissText?: string
  type?: 'error' | 'warning' | 'info' | 'success'
}

export interface SuccessAlertProps {
  title?: string
  message: string
  onDismiss?: () => void
  isVisible?: boolean
  autoClose?: boolean
  autoCloseDelay?: number
  className?: string
}

export interface NetworkStatusProps {
  isOnline: boolean
  className?: string
  onReconnect?: () => void
}

export interface ErrorToastProps {
  message: string
  isVisible: boolean
  onDismiss: () => void
  autoCloseDelay?: number
  type?: 'error' | 'warning' | 'info' | 'success'
}

export interface LoadingAlertProps {
  message: string
  isVisible: boolean
  className?: string
}

// ============================================================
// INTERACTIVE COMPONENT INTERFACES
// ============================================================

// Interactive Example Component
export interface ExampleContent {
  title: string
  description: string
  category?: string
  controls: Control[]
  display: DisplayElement[]
  explanation: string
  initialValues?: Record<string, number | boolean>
}

export interface Control {
  id: string
  type: 'slider' | 'toggle' | 'button'
  label: string
  min?: number
  max?: number
  step?: number
  defaultValue?: number | boolean
}

export interface DisplayElement {
  id: string
  type: 'text' | 'formula' | 'shape' | 'color' | 'graph' | 'visualization'
  content: string
  style?: Record<string, unknown>
}

// Fill in the Blank Component
export interface FillInTheBlankContent {
  title?: string
  description?: string
  question: string
  template: string // Text with ___ for blanks
  text?: string
  answers: string[] // Correct answers for each blank
  blanks?: Array<{
    id: string
    answer: string
    placeholder: string
    hint?: string
  }>
  hints?: string[] // Optional hints for each blank
  explanation?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  category?: string
  acceptAlternatives?: boolean // Whether to accept close matches
}

// Multiple Choice Component 
export interface MultipleChoiceContent {
  title: string
  description: string
  question: string
  choices: Array<{
    id: string
    text: string
    isCorrect: boolean
    explanation?: string
  }>
  explanation?: string
}

// Step by Step Solver Component
export interface StepData {
  title: string
  content: string
  isVisible?: boolean
  showHint?: boolean
  hint?: string
}

export interface StepByStepContent {
  title: string
  description: string
  problem: string
  steps: StepData[]
  solution?: string
}

// Text Highlighter Component
export interface HighlighterContent {
  title: string
  description: string
  text: string
  categories: HighlightCategory[]
  explanation?: string
}

export interface HighlightCategory {
  id: string
  name: string
  color: string
  description?: string
}

export interface HighlightTarget {
  id: string
  text: string
  categoryId: string
  startIndex: number
  endIndex: number
}

export interface UserHighlight {
  text: string
  categoryId: string
  startIndex: number
  endIndex: number
}

// Graph Visualizer Component
export interface GraphContent {
  title: string
  description: string
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'function'
  data: DataPoint[] | FunctionConfig
  xAxis: AxisConfig
  yAxis: AxisConfig
  datasets?: DataPoint[][]
  functions?: FunctionConfig[]
  controls?: GraphControl[]
  interactive?: boolean
  annotations?: Array<{
    x: number
    y: number
    text: string
  }>
  explanation?: string
  category?: string
}

export interface DataPoint {
  x: number | string
  y: number
  label?: string
  color?: string
}

export interface FunctionConfig {
  id?: string
  expression: string
  color?: string
  domain?: [number, number]
  resolution?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

export interface AxisConfig {
  label: string
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface GraphControl {
  id: string
  label: string
  type: 'slider' | 'toggle' | 'button'
  min?: number
  max?: number
  step?: number
  defaultValue: number | boolean
}

// Formula Explorer Component
export interface FormulaContent {
  title: string
  description: string
  formula: string
  variables: FormulaVariable[]
  steps?: FormulaStep[]
  examples?: FormulaExample[]
  explanation?: string
  category?: string
}

export interface FormulaVariable {
  id: string
  name: string
  symbol: string
  description?: string
  min: number
  max: number
  step: number
  defaultValue: number
  unit?: string
}

export interface FormulaStep {
  id: string
  description: string
  expression: string
  formula?: string
  explanation?: string
  highlight?: boolean
}

export interface FormulaExample {
  id: string
  name: string
  title?: string
  values: Record<string, number>
  result?: number | string
  description?: string
  explanation?: string
}

// Explainer Component
export interface ExplainerContent {
  title: string
  description?: string
  sections: Array<{
    heading: string
    paragraphs: string[]
    image?: {
      url: string
      alt: string
      caption?: string
    }
  }>
  summary?: string
  keywords?: string[]
  references?: Array<{
    title: string
    url?: string
  }>
}

// Drag and Drop Component
export interface DragAndDropContent {
  title: string
  description: string
  instruction?: string
  items: DragItem[]
  targets: DropTarget[]
  explanation?: string
}

export interface DragItem {
  id: string
  text: string
  correctTargetId: string
  hint?: string
}

export interface DropTarget {
  id: string
  label: string
  description?: string
  acceptedItemIds?: string[]
}

// Concept Card Component
export interface ConceptCardContent {
  title: string
  summary: string
  details: string
  keyPoints: string[]
  examples: string[]
  description?: string
  image?: {
    url: string
    alt: string
  }
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category?: string
}

// Progress Quiz Component
export interface QuizContent {
  title: string
  description: string
  questions: QuizQuestion[]
  timeLimit?: number
  passingScore?: number
  explanation?: string
}

export interface QuizQuestion {
  id: string
  text: string
  options: Array<{
    id: string
    text: string
    isCorrect: boolean
  }>
  explanation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

// Placeholder Component
export interface PlaceholderContent {
  title?: string
  message: string
  type?: 'loading' | 'error' | 'empty' | 'retry'
  action?: {
    label: string
    handler: string
  }
}

// ============================================================
// COMPONENT PROPS
// ============================================================

// History Components
export interface HistoryPaneProps {
  user: { id: string } | null
  subjects: Subject[]
  selectedSubject: Subject | null
  onSubjectSelect: (subject: Subject) => void
  onDeleteSubject: (subjectId: string) => void
  onCreateSubject: (name: string) => void
  className?: string
}

export interface SubjectItemProps {
  subject: Subject
  isSelected: boolean
  onSelect: (subject: Subject) => void
  onDelete: (subjectId: string) => void
}

export interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  subjectName: string
  isLoading?: boolean
}

export interface ContentHistorySidebarProps {
  subjects: Subject[]
  selectedSubject: Subject | null
  onSubjectSelect: (subject: Subject) => void
  className?: string
}

// Chat Components
export interface ChatPaneProps {
  user: { id: string } | null
  selectedSubject: Subject | null
  onError?: (error: AppError) => void
  onGeneratedContent?: (content: InteractiveContent) => void
  className?: string
}

export interface ChatPaneRef {
  addMessage: (message: Message) => void
  addAssistantMessage: (content: string) => void
  getMessages: () => Message[]
  clearMessages: () => void
}

export interface ChatMessageListProps {
  messages: Message[]
  isLoading?: boolean
  onRetry?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  className?: string
}

export interface ChatRetryMessageProps {
  message: Message
  onRetry: () => void
}

export interface InteractionData {
  action: string
  componentId: string
  data?: unknown
}

// Content Components
export interface ContentPaneProps {
  selectedSubject: Subject | null
  content?: InteractiveContent | null
  onInteraction: (action: string, data: unknown) => void
  className?: string
}

export interface InteractiveContent {
  id: string
  type: ComponentType
  data: unknown
  onInteraction?: (action: string, data: unknown) => void
}

// Error Handling Components
export interface ErrorContextType {
  error: AppError | null
  setError: (error: AppError | null) => void
  clearError: () => void
  handleError: (error: unknown, operation?: string) => void
}

export interface ErrorProviderProps {
  children: React.ReactNode
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
} 