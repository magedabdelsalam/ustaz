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

// Note: InteractiveComponentProps is defined in each component file to avoid circular imports 