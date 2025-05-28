# AI Component Selection Guide

This guide helps the AI system choose the most appropriate interactive component based on learning context, user needs, and educational objectives.

## Component Selection Framework

### 1. Learning Objective Analysis

When a user requests learning content, analyze these factors:

- **Subject Area**: Math, Science, Language Arts, History, etc.
- **Complexity Level**: Beginner, Intermediate, Advanced
- **Learning Goal**: Understanding concepts, practicing skills, assessment, exploration
- **Content Type**: Theoretical explanation, practical application, problem-solving

### 2. User Intent Recognition

**Keywords and Phrases that indicate component choice:**

#### Assessment & Testing Intent
- "quiz me", "test my knowledge", "practice questions", "exam prep"
- **→ USE: `progress-quiz`**

#### Formula & Mathematical Exploration
- "how does X affect Y", "change parameters", "explore equation", "what if"
- **→ USE: `formula-explorer`** (for math/science formulas)
- **→ USE: `interactive-example`** (for general demonstrations)

#### Data Visualization & Analysis
- "show me a graph", "visualize data", "plot function", "chart", "trends"
- **→ USE: `graph-visualizer`**

#### Text Analysis & Reading Comprehension
- "analyze text", "identify themes", "find examples", "highlight", "annotate"
- **→ USE: `text-highlighter`**

#### Detailed Explanations & Reading Content
- "explain in detail", "tell me about", "I want to understand", "explain thoroughly", "give me a breakdown", "walk me through"
- **→ USE: `explainer`**

#### Matching & Categorization
- "match", "pair", "connect", "categorize", "group", "sort"
- **→ USE: `drag-drop`**

#### Problem-Solving Process
- "solve step by step", "show working", "break down problem", "methodology"
- **→ USE: `step-solver`**

#### Knowledge Check (Simple)
- "quick question", "true or false", "choose correct", "which one"
- **→ USE: `multiple-choice`**

#### Concept Explanation
- "explain concept", "what is", "definition", "overview"
- **→ USE: `concept-card`**

#### Practice & Skills
- "practice", "fill in", "complete", "exercise"
- **→ USE: `fill-blank`**

#### Interactive Demonstrations
- "show me how", "demonstrate", "simulate", "experiment"
- **→ USE: `interactive-example`**

## Subject-Specific Guidelines

### Mathematics
- **Algebra/Calculus**: `formula-explorer` for equation manipulation, `graph-visualizer` for function plotting
- **Geometry**: `interactive-example` for shape manipulation, `graph-visualizer` for coordinate geometry
- **Statistics**: `graph-visualizer` for data analysis, `drag-drop` for categorizing data types
- **Practice Problems**: `step-solver` for complex problems, `multiple-choice` for quick checks

### Science
- **Physics**: `formula-explorer` for physics equations, `interactive-example` for simulations
- **Chemistry**: `drag-drop` for element matching, `interactive-example` for molecular models
- **Biology**: `text-highlighter` for specimen analysis, `drag-drop` for classification
- **Lab Skills**: `step-solver` for procedures, `interactive-example` for virtual experiments

### Language Arts
- **Reading Comprehension**: `text-highlighter` for analysis, `multiple-choice` for comprehension checks
- **Grammar**: `fill-blank` for sentence completion, `drag-drop` for parts of speech
- **Literature Analysis**: `text-highlighter` for theme identification, `concept-card` for literary devices
- **Writing Skills**: `step-solver` for essay structure, `interactive-example` for writing techniques

### History
- **Timeline Activities**: `drag-drop` for chronological ordering
- **Document Analysis**: `text-highlighter` for primary source analysis
- **Cause and Effect**: `interactive-example` for exploring historical relationships
- **Assessment**: `progress-quiz` for comprehensive testing

### General Education
- **Review Sessions**: `progress-quiz` for comprehensive assessment
- **Concept Introduction**: `concept-card` for new topics
- **Skill Practice**: `fill-blank` or `multiple-choice` for reinforcement
- **Interactive Learning**: `interactive-example` for hands-on exploration

## Decision Tree

```
User Request
├── Contains assessment keywords? → progress-quiz
├── Mathematical formula involved? → formula-explorer
├── Data visualization needed? → graph-visualizer
├── Text analysis required? → text-highlighter
├── Detailed explanation needed? → explainer
├── Matching/sorting task? → drag-drop
├── Step-by-step process? → step-solver
├── Simple Q&A? → multiple-choice
├── Concept explanation? → concept-card
├── Fill-in exercise? → fill-blank
└── Interactive demo needed? → interactive-example
```

## Component Complexity Levels

### Beginner Level
- **Primary**: `multiple-choice`, `concept-card`, `fill-blank`, `explainer`
- **Secondary**: `drag-drop`, `interactive-example`

### Intermediate Level
- **Primary**: `progress-quiz`, `text-highlighter`, `step-solver`, `explainer`
- **Secondary**: `formula-explorer`, `graph-visualizer`

### Advanced Level
- **Primary**: `formula-explorer`, `graph-visualizer`, `step-solver`, `explainer`
- **Secondary**: `progress-quiz`, `text-highlighter`

## Content Adaptation Guidelines

### When generating content for each component:

#### MultipleChoice
```typescript
{
  question: "Clear, specific question",
  options: ["4 options max", "avoid 'all/none of above'", "similar length", "plausible distractors"],
  correctAnswer: "Exact match to one option",
  explanation: "Why correct + why others wrong"
}
```

#### ProgressQuiz
```typescript
{
  questions: [
    // Mix question types: multiple-choice, true-false, fill-blank
    // 5-10 questions for good assessment
    // Include explanations for learning
  ],
  timeLimit: 300, // 5 minutes typical
  passingScore: 70 // Adjust based on difficulty
}
```

#### FormulaExplorer
```typescript
{
  formula: "Use standard mathematical notation",
  variables: [
    // 2-4 variables max for clarity
    // Meaningful ranges and steps
    // Include units and descriptions
  ],
  examples: [
    // 2-3 real-world scenarios
  ]
}
```

#### GraphVisualizer
```typescript
{
  type: "function" | "bar" | "line" | "pie" | "scatter",
  data: {
    // For functions: use clear mathematical expressions
    // For data: use realistic, relevant datasets
  },
  controls: [
    // 2-4 parameters max
    // Meaningful ranges that show clear effects
  ]
}
```

#### TextHighlighter
```typescript
{
  text: "200-500 words optimal",
  categories: [
    // 2-4 categories max
    // Clear, distinct categories
    // Different colors for each
  ],
  targets: [
    // Pre-define correct answers for assessment
  ]
}
```

#### InteractiveExample
```typescript
{
  controls: [
    // Interactive sliders, toggles
    // Real-time visual feedback
  ],
  display: [
    // Visual elements that respond to controls
    // Mathematical expressions
    // Animated shapes
  ]
}
```

#### DragAndDrop
```typescript
{
  items: [
    // 4-8 items optimal
    // Clear, concise labels
  ],
  targets: [
    // Same number as items
    // Descriptive target labels
  ]
}
```

#### Explainer
```typescript
{
  title: "Clear, descriptive topic title",
  overview: "Brief summary (1-2 sentences) of what will be explained",
  sections: [
    {
      heading: "Section title that breaks down the topic",
      paragraphs: [
        // 2-4 paragraphs per section
        // Each paragraph 3-5 sentences
        // Clear, engaging explanations
        // Avoid wall of text - break into digestible chunks
      ]
    }
    // 3-6 sections optimal for comprehensive coverage
  ],
  conclusion: "Optional summary that ties everything together",
  difficulty: "beginner" | "intermediate" | "advanced",
  estimatedReadTime: 5 // Optional: auto-calculated based on content
}
```

## Implementation Best Practices

### Component Selection Priority
1. **Match user intent** (highest priority)
2. **Subject appropriateness**
3. **Complexity level**
4. **Learning objective**
5. **Engagement factor**

### Content Quality Standards
- **Clear instructions** for every component
- **Relevant examples** that connect to real-world applications
- **Appropriate difficulty** for the target audience
- **Immediate feedback** to support learning
- **Progressive complexity** within sessions

### Accessibility Considerations
- All components support keyboard navigation
- Screen reader compatible
- Color-blind friendly color schemes
- Appropriate contrast ratios
- Clear, readable fonts

### Performance Guidelines
- Lazy loading for heavy components
- Efficient data structures
- Minimal re-renders
- Responsive design for all devices
- Fast interaction feedback

## Example Usage Scenarios

### Scenario 1: "Explain quadratic functions"
**Selected Component**: `formula-explorer`
**Reasoning**: Mathematical formula that benefits from parameter manipulation
**Content**: y = ax² + bx + c with sliders for a, b, c coefficients

### Scenario 2: "Quiz me on cell biology"
**Selected Component**: `progress-quiz`
**Reasoning**: Assessment request with comprehensive topic coverage
**Content**: Mixed question types about organelles, functions, processes

### Scenario 3: "Show me population growth trends"
**Selected Component**: `graph-visualizer`
**Reasoning**: Data visualization request
**Content**: Line graph with historical population data and growth controls

### Scenario 4: "Identify literary devices in this poem"
**Selected Component**: `text-highlighter`
**Reasoning**: Text analysis task
**Content**: Poem text with categories for metaphor, alliteration, rhyme scheme

### Scenario 5: "Match historical events to dates"
**Selected Component**: `drag-drop`
**Reasoning**: Matching/pairing task
**Content**: Event descriptions to drag onto timeline positions

### Scenario 6: "Explain photosynthesis in detail"
**Selected Component**: `explainer`
**Reasoning**: Request for comprehensive explanation of a complex topic
**Content**: Multi-section breakdown covering light reactions, Calvin cycle, factors affecting rate, and importance to life

This guide ensures consistent, appropriate component selection that enhances learning outcomes and user engagement. 