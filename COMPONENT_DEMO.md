# Interactive Components Demo Guide

This document shows how to use all the interactive components in the Ustaz learning platform.

## Available Components

### 1. DragAndDrop Component (Enhanced)
The existing drag & drop component has been enhanced and is now complete with:
- Meaningful title generation based on content
- Visual feedback with icons
- Progress tracking
- Reset functionality

### 2. InteractiveExample Component
For demonstrating concepts with interactive controls like sliders and toggles.

```typescript
const exampleContent = {
  title: "Physics: Simple Harmonic Motion",
  description: "Explore how changing parameters affects wave motion",
  controls: [
    {
      id: "amplitude",
      type: "slider",
      label: "Amplitude",
      min: 1,
      max: 10,
      step: 0.1,
      defaultValue: 5
    },
    {
      id: "frequency", 
      type: "slider",
      label: "Frequency",
      min: 0.1,
      max: 2,
      step: 0.1,
      defaultValue: 1
    },
    {
      id: "showGrid",
      type: "toggle",
      label: "Show Grid",
      defaultValue: true
    }
  ],
  display: [
    {
      id: "formula",
      type: "formula",
      content: "y = $amplitude * sin(2π * $frequency * $time)"
    },
    {
      id: "shape",
      type: "shape", 
      content: "circle",
      style: { size: "$amplitude * 10" }
    }
  ],
  explanation: "Simple harmonic motion follows a sinusoidal pattern where amplitude determines the maximum displacement and frequency determines how fast the oscillation occurs."
}
```

### 3. ProgressQuiz Component
A comprehensive quiz component with progress tracking, timers, and detailed feedback.

```typescript
const quizContent = {
  title: "Biology Quiz: Cell Structure",
  description: "Test your knowledge of cell organelles and their functions",
  timeLimit: 300, // 5 minutes
  passingScore: 70,
  allowRetry: true,
  showExplanations: true,
  questions: [
    {
      id: "q1",
      question: "Which organelle is responsible for protein synthesis?",
      type: "multiple-choice",
      options: ["Mitochondria", "Ribosome", "Nucleus", "Golgi apparatus"],
      correctAnswer: "Ribosome",
      explanation: "Ribosomes are the cellular structures responsible for protein synthesis.",
      points: 10
    },
    {
      id: "q2", 
      question: "The mitochondria is known as the powerhouse of the cell.",
      type: "true-false",
      correctAnswer: "true",
      explanation: "Mitochondria produce ATP, which is the cell's main energy currency.",
      points: 5
    },
    {
      id: "q3",
      question: "What is the gel-like substance that fills the cell?",
      type: "fill-blank",
      correctAnswer: "cytoplasm",
      explanation: "Cytoplasm is the gel-like substance that fills the space between organelles.",
      points: 10
    }
  ]
}
```

### 4. GraphVisualizer Component
For creating interactive charts and mathematical function visualizations.

```typescript
const graphContent = {
  title: "Quadratic Function Explorer",
  description: "Explore how coefficients affect the shape of quadratic functions",
  type: "function",
  data: {
    expression: "a*x^2 + b*x + c",
    domain: [-10, 10],
    resolution: 100
  },
  xAxis: {
    label: "x-axis",
    min: -10,
    max: 10
  },
  yAxis: {
    label: "f(x)",
    min: -20,
    max: 20
  },
  controls: [
    {
      id: "a",
      label: "Coefficient a",
      type: "slider",
      min: -2,
      max: 2,
      step: 0.1,
      defaultValue: 1
    },
    {
      id: "b",
      label: "Coefficient b", 
      type: "slider",
      min: -5,
      max: 5,
      step: 0.1,
      defaultValue: 0
    },
    {
      id: "c",
      label: "Coefficient c",
      type: "slider", 
      min: -5,
      max: 5,
      step: 0.1,
      defaultValue: 0
    }
  ],
  explanation: "The coefficient 'a' controls the width and direction of the parabola, 'b' affects the position of the vertex, and 'c' is the y-intercept."
}
```

### 5. FormulaExplorer Component
For exploring mathematical formulas with interactive variable manipulation.

```typescript
const formulaContent = {
  title: "Area of a Circle",
  description: "Explore how the radius affects the area of a circle",
  formula: "π * r^2",
  variables: [
    {
      id: "r",
      symbol: "r",
      name: "Radius",
      unit: "units",
      min: 1,
      max: 10,
      step: 0.1,
      defaultValue: 5,
      description: "The distance from the center to the edge of the circle"
    }
  ],
  steps: [
    {
      id: "step1",
      description: "Square the radius",
      expression: "r^2"
    },
    {
      id: "step2", 
      description: "Multiply by π",
      expression: "π * r^2",
      highlight: true
    }
  ],
  examples: [
    {
      id: "example1",
      name: "Small Circle",
      values: { r: 2 },
      description: "A circle with radius 2 units"
    },
    {
      id: "example2",
      name: "Large Circle", 
      values: { r: 8 },
      description: "A circle with radius 8 units"
    }
  ],
  explanation: "The area of a circle grows quadratically with the radius. Doubling the radius increases the area by a factor of 4."
}
```

### 6. TextHighlighter Component
For interactive text analysis and annotation exercises.

```typescript
const highlighterContent = {
  title: "Literary Analysis: Character Types",
  description: "Identify different character types in the text passage",
  instructions: "Select text and highlight it according to the character type categories below",
  text: "Harry Potter was a brave young wizard who lived with his cruel relatives, the Dursleys. His best friend Hermione was incredibly intelligent and always helped him with difficult spells. Meanwhile, the evil Lord Voldemort plotted in the shadows, seeking to destroy Harry and take over the wizarding world.",
  categories: [
    {
      id: "protagonist",
      name: "Protagonist",
      color: "#22c55e",
      description: "The main character or hero",
      shortcut: "P"
    },
    {
      id: "supporting",
      name: "Supporting Character", 
      color: "#3b82f6",
      description: "Characters who help the protagonist",
      shortcut: "S"
    },
    {
      id: "antagonist",
      name: "Antagonist",
      color: "#ef4444", 
      description: "The villain or opposing force",
      shortcut: "A"
    }
  ],
  targets: [
    {
      id: "target1",
      text: "Harry Potter",
      categoryId: "protagonist",
      startIndex: 0,
      endIndex: 12
    },
    {
      id: "target2",
      text: "Hermione",
      categoryId: "supporting", 
      startIndex: 115,
      endIndex: 123
    },
    {
      id: "target3",
      text: "Lord Voldemort",
      categoryId: "antagonist",
      startIndex: 220,
      endIndex: 234
    }
  ],
  showFeedback: true,
  explanation: "Understanding character roles helps readers analyze story structure and character development throughout a narrative."
}
```

## Component Integration

All components follow the same interface:

```typescript
interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}
```

This allows them to be used interchangeably in the learning platform with consistent event handling and content management.

## Usage in the Application

Import and use any component:

```typescript
import { 
  DragAndDrop, 
  InteractiveExample, 
  ProgressQuiz, 
  GraphVisualizer, 
  FormulaExplorer, 
  TextHighlighter 
} from '@/components/interactive'

// Use in your component
<InteractiveExample
  id="example-1"
  content={exampleContent}
  onInteraction={(action, data) => {
    console.log('User interaction:', action, data)
  }}
/>
```

## Features

All components include:
- ✅ Responsive design using Tailwind CSS
- ✅ shadcn/ui components for consistency
- ✅ TypeScript support with full type safety
- ✅ Accessibility features (ARIA labels, keyboard navigation)
- ✅ Dark mode compatibility
- ✅ Progress tracking and analytics
- ✅ Reset functionality
- ✅ Modern UI with smooth animations
- ✅ Mobile-friendly responsive layouts 