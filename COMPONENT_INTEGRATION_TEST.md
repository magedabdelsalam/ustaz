# Component Integration Test Guide

This guide helps verify that all interactive components work correctly within the Ustaz learning platform.

## Test Scenarios

### 1. Component Rendering Test

Each component should render without errors when provided with valid content data:

```javascript
// Test each component type
const testComponents = [
  { type: 'multiple-choice', content: multipleChoiceData },
  { type: 'drag-drop', content: dragDropData },
  { type: 'interactive-example', content: exampleData },
  { type: 'progress-quiz', content: quizData },
  { type: 'graph-visualizer', content: graphData },
  { type: 'formula-explorer', content: formulaData },
  { type: 'text-highlighter', content: highlighterData },
  { type: 'concept-card', content: conceptData },
  { type: 'step-solver', content: stepData },
  { type: 'fill-blank', content: fillBlankData }
];
```

### 2. Event Handling Test

All components should properly trigger `onInteraction` callbacks:

```javascript
const testInteraction = (action, data) => {
  console.log('Component interaction:', action, data);
  // Verify interaction data contains:
  // - componentId
  // - action type
  // - relevant interaction data
};
```

### 3. State Management Test

Components should:
- Maintain internal state correctly
- Reset to initial state when reset button is clicked
- Persist user progress during interaction
- Handle edge cases gracefully

### 4. Integration with ContentPane

Components should integrate seamlessly with the ContentPane:
- Render in the content feed
- Handle interaction events properly
- Display loading states appropriately
- Show error states when content is invalid

## Sample Test Data

### InteractiveExample Test Data
```javascript
const exampleTestData = {
  title: "Test Interactive Example",
  description: "Testing component functionality",
  controls: [
    {
      id: "testSlider",
      type: "slider",
      label: "Test Value",
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 50
    }
  ],
  display: [
    {
      id: "testDisplay",
      type: "text",
      content: "Value: $testSlider"
    }
  ],
  explanation: "This tests the interactive example component"
};
```

### ProgressQuiz Test Data
```javascript
const quizTestData = {
  title: "Integration Test Quiz",
  description: "Testing quiz functionality",
  questions: [
    {
      id: "test1",
      question: "Is this component working?",
      type: "true-false",
      correctAnswer: "true",
      explanation: "Yes, it should be working!"
    }
  ],
  timeLimit: 60,
  allowRetry: true
};
```

### GraphVisualizer Test Data
```javascript
const graphTestData = {
  title: "Test Graph",
  description: "Testing graph visualization",
  type: "function",
  data: {
    expression: "x^2",
    domain: [-10, 10]
  },
  xAxis: { label: "X" },
  yAxis: { label: "Y" }
};
```

### FormulaExplorer Test Data
```javascript
const formulaTestData = {
  title: "Test Formula",
  description: "Testing formula exploration",
  formula: "a * x + b",
  variables: [
    {
      id: "a",
      symbol: "a",
      name: "Coefficient A",
      min: -10,
      max: 10,
      step: 0.1,
      defaultValue: 1
    },
    {
      id: "b",
      symbol: "b", 
      name: "Constant B",
      min: -10,
      max: 10,
      step: 0.1,
      defaultValue: 0
    }
  ]
};
```

### TextHighlighter Test Data
```javascript
const highlighterTestData = {
  title: "Test Text Analysis",
  description: "Testing text highlighting",
  text: "This is a test sentence with important words to highlight.",
  categories: [
    {
      id: "important",
      name: "Important",
      color: "#3b82f6"
    }
  ]
};
```

## Validation Checklist

### ✅ Basic Functionality
- [ ] All components render without console errors
- [ ] Interactive elements respond to user input
- [ ] Reset functionality works correctly
- [ ] Visual feedback is provided for user actions

### ✅ Event Integration
- [ ] onInteraction callbacks are triggered correctly
- [ ] Event data contains all required fields
- [ ] Component interactions are logged properly
- [ ] Dashboard receives interaction events

### ✅ Content Management
- [ ] Components handle invalid/missing data gracefully
- [ ] Loading states are displayed appropriately
- [ ] Error boundaries catch component errors
- [ ] Content persistence works correctly

### ✅ User Experience
- [ ] Components are responsive on mobile devices
- [ ] Accessibility features work correctly
- [ ] Visual design is consistent across components
- [ ] Performance is acceptable for all interactions

### ✅ Advanced Features
- [ ] Keyboard navigation works correctly
- [ ] Screen reader compatibility
- [ ] Dark mode support (if implemented)
- [ ] Animation performance is smooth

## Manual Testing Steps

1. **Component Rendering**
   - Navigate to the learning platform
   - Chat with AI to generate each component type
   - Verify components appear in the content feed
   - Check for console errors

2. **User Interactions**
   - Interact with each component's controls
   - Submit answers/complete activities
   - Use reset buttons
   - Verify feedback messages

3. **Edge Cases**
   - Test with empty/invalid content
   - Test rapid interactions
   - Test with very long content
   - Test browser refresh behavior

4. **Cross-Browser Testing**
   - Test in Chrome, Firefox, Safari
   - Test on mobile browsers
   - Verify consistent behavior

## Automated Testing

Consider implementing automated tests for:

```javascript
// Component rendering tests
describe('Interactive Components', () => {
  test('renders without crashing', () => {
    // Test each component with sample data
  });
  
  test('handles user interactions', () => {
    // Test event handling
  });
  
  test('resets correctly', () => {
    // Test reset functionality
  });
});
```

## Performance Monitoring

Monitor these metrics:
- Component render time
- Interaction response time
- Memory usage during extended use
- Bundle size impact

## Known Issues & Limitations

Document any known issues:
- Browser compatibility notes
- Performance limitations
- Feature gaps
- Planned improvements

This integration test guide ensures all components work harmoniously within the learning platform and provide a seamless educational experience. 