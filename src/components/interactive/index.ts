// Interactive Learning Components Library
export { MultipleChoice } from './MultipleChoice'
export { FillInTheBlank } from './FillInTheBlank'
export { DragAndDrop } from './DragAndDrop'
export { FormulaExplorer, InteractiveExample, ProgressQuiz, GraphVisualizer } from './DragAndDrop'
export { StepByStepSolver } from './StepByStepSolver'
export { ConceptCard } from './ConceptCard'

// Component type definitions
export interface InteractiveComponentProps {
  onInteraction: (action: string, data: any) => void
  content: any
  id: string
}

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