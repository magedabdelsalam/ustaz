# Tasks: AI Tutor Pedagogical Flow, Tool Usage, and Context Retention

## Relevant Files

- `src/lib/ai-tutor-service.ts` - Core backend logic for AI tutor, tool usage, lesson flow, and context management.
- `src/hooks/useAITutor.ts` - React hook for managing AI tutor state, context, and API calls in the frontend.
- `src/components/StreamPane.tsx` - Main UI stream for displaying messages and interactive components.
- `src/components/Dashboard.tsx` - Main dashboard, lesson plan sidebar, and stream integration.
- `src/components/interactive/` - All interactive learning components (explainer, multiple-choice, fill-blank, etc.).
- `src/types/index.ts` - Type definitions for lessons, subjects, interactive content, and context.
- `src/components/HistoryPane.tsx` - Subject and lesson selection, user goals/level input.
- `src/components/__tests__/` - Unit and integration tests for components and flows.

### Notes

- Unit tests should be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx`).
- Use `npx jest` to run all tests or specify a path for targeted testing.

## Tasks

- [x] 1.0 Pedagogical Flow
  - [x] 1.1 Assess User Level & Goals
    - [x] Implement logic for the AI to ask about the user's goals and current knowledge at the start of a new subject/session.
    - [x] Ensure this information is stored in the context and referenced in future responses.
  - [x] 1.2 Lesson Plan Generation
    - [x] Ensure the AI always generates a lesson plan using the `new_lesson_plan` tool after assessing user goals/level.
    - [x] Display the lesson plan to the user in the UI.
  - [x] 1.3 Concept Delivery with Interactive Components
    - [x] For each lesson/concept, ensure the AI uses the `explainer` or other interactive teaching tools to introduce the concept.
    - [x] Refactor backend logic to enforce interactive component generation for all educational content.
  - [x] 1.4 Practice and Assessment Integration
    - [x] After each concept, require the AI to generate practice activities (`multiple-choice`, `fill-blank`, `drag-drop`, etc.).
    - [x] After practice, require the AI to generate an assessment (`progress-quiz`, `step-solver`, etc.) before advancing.
  - [x] 1.5 Lesson Progression Logic
    - [x] Only allow progression to the next lesson when the user demonstrates understanding (e.g., passes a quiz or practice).
    - [x] Use `lesson_complete` and `next_lesson` tools to track and advance progress.
  - [x] 1.6 Lesson/Subject Summary
    - [x] At the end of each lesson or subject, have the AI summarize progress and suggest next steps.

- [x] 2.0 Tool Usage
  - [x] 2.1 Enforce Interactive Component Tool Calls
    - [x] Refactor AI backend to always use the `interactive_component` tool for educational content.
    - [x] Map tool types to learning stages (explainer, interactive-example, practice, assessment).
  - [x] 2.2 Clarifying Question Handling
    - [x] Ensure the AI uses the `clarifying_question` tool if the user's input is ambiguous.
  - [x] 2.3 Tool Call Auditing
    - [x] Add logging/tests to verify that 95%+ of educational responses use interactive components.

- [x] 3.0 Context Retention
  - [x] 3.1 Context Inclusion in Tool Calls
    - [x] Ensure every tool call and response includes the current subject, lesson, and progress context.
  - [x] 3.2 Context Update Logic
    - [x] Update context after every user interaction, lesson completion, or assessment.
  - [x] 3.3 Context Persistence
    - [x] Implement context persistence across sessions (if possible).

- [x] 4.0 UI/UX
  - [x] 4.1 StreamPane & ChatMessageList Updates
    - [x] Ensure UI components reflect the pedagogical flow and context (lesson plan, current lesson, progress, etc.).
    - [x] Display interactive components and assessments in the stream.
  - [x] 4.2 Accessibility & Performance
    - [x] Audit all interactive components for accessibility (keyboard, screen reader, color contrast).
    - [x] Implement virtualization for long message lists.
    - [x] Add focus management and keyboard navigation.
    - [x] Ensure proper ARIA labels and roles.
  - [x] 4.3 Error Handling & Loading States
    - [x] Implement error boundaries for graceful failure handling
    - [x] Add loading states for async operations
    - [x] Implement retry mechanisms for failed operations
    - [x] Add error alerts and notifications
    - [x] Implement proper error logging and monitoring

- [x] 5.0 Testing
  - [x] Implement unit tests for all components
  - [x] Add integration tests for component interactions
  - [x] Test error handling and edge cases
  - [x] Ensure 100% test coverage for critical features
  - [x] Add end-to-end tests for key user flows

- [ ] 6.0 Success Metrics & Validation
  - [x] 6.1 Track Interactive Component Usage Rate
  - [x] 6.2 User Feedback Collection
  - [x] 6.3 Iterate Based on User Testing 