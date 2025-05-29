// Interactive Learning Components Library
import dynamic from 'next/dynamic'

// Lazily load heavy interactive components to improve initial page load time
export const MultipleChoice = dynamic(
  () => import('./MultipleChoice').then((m) => m.MultipleChoice),
  { ssr: false }
)
export const FillInTheBlank = dynamic(
  () => import('./FillInTheBlank').then((m) => m.FillInTheBlank),
  { ssr: false }
)
export const DragAndDrop = dynamic(
  () => import('./DragAndDrop').then((m) => m.DragAndDrop),
  { ssr: false }
)
export const StepByStepSolver = dynamic(
  () => import('./StepByStepSolver').then((m) => m.StepByStepSolver),
  { ssr: false }
)
export const ConceptCard = dynamic(
  () => import('./ConceptCard').then((m) => m.ConceptCard),
  { ssr: false }
)

// New interactive components
export const InteractiveExample = dynamic(
  () => import('./InteractiveExample').then((m) => m.InteractiveExample),
  { ssr: false }
)
export const ProgressQuiz = dynamic(
  () => import('./ProgressQuiz').then((m) => m.ProgressQuiz),
  { ssr: false }
)
export const GraphVisualizer = dynamic(
  () => import('./GraphVisualizer').then((m) => m.GraphVisualizer),
  { ssr: false }
)
export const FormulaExplorer = dynamic(
  () => import('./FormulaExplorer').then((m) => m.FormulaExplorer),
  { ssr: false }
)
export const TextHighlighter = dynamic(
  () => import('./TextHighlighter').then((m) => m.TextHighlighter),
  { ssr: false }
)
export const Explainer = dynamic(
  () => import('./Explainer').then((m) => m.Explainer),
  { ssr: false }
)
export const Placeholder = dynamic(
  () => import('./Placeholder').then((m) => m.Placeholder),
  { ssr: false }
)

// Component type definitions
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

// Note: InteractiveComponentProps is now defined here to be shared across all components 