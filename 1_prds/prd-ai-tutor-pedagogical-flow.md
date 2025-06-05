# AI Tutor Pedagogical Flow, Tool Usage, and Context Retention PRD

## Overview

**Goal:**  
Transform the AI assistant into a truly effective, context-aware teacher that:
- Understands user learning goals and current level,
- Creates and adapts lesson plans,
- Delivers each concept using the most digestible interactive component,
- Tests and practices with the student,
- Assesses understanding and progress,
- Advances through lessons and levels only when mastery is demonstrated,
- Retains and leverages context at all times.

## Problem Statement

Currently, the AI assistant:
- Fails to consistently generate interactive components for teaching,
- Does not always use the right tool for the user's learning stage,
- Loses or mismanages context (subject, lesson, progress),
- Behaves more like a chatbot than a structured, adaptive teacher.

## Objectives

- **Pedagogical Flow:** The AI should act as a teacher, not just a responder. It should:
  - Assess the student's level and goals,
  - Create a lesson plan,
  - Teach each concept using the best interactive method,
  - Test/practice with the student,
  - Assess mastery before advancing,
  - Progress through lessons and levels in a structured way.

- **Tool Usage:** The AI must:
  - Use the correct tool (e.g., explainer, quiz, practice, assessment) for each learning stage,
  - Always generate interactive components for teaching and practice,
  - Avoid generic chat responses for educational content.

- **Context Retention:** The AI must:
  - Always maintain and update the subject, lesson, and progress context,
  - Use this context to inform every response and tool call,
  - Never "forget" the current lesson, user progress, or learning goals.

## User Stories

1. **As a student**, I want the AI to assess my current knowledge and goals so that my learning is personalized.
2. **As a student**, I want the AI to create a clear lesson plan so I know what I'll learn and in what order.
3. **As a student**, I want each concept to be taught using interactive, engaging components so I can understand and practice effectively.
4. **As a student**, I want the AI to test my understanding before moving on, so I don't miss key concepts.
5. **As a student**, I want the AI to remember my progress and context, so my learning is continuous and adaptive.

## Functional Requirements

### 1. Pedagogical Flow

- On new subject or session, the AI must:
  - Ask about the user's goals and current level,
  - Propose or generate a lesson plan (using `new_lesson_plan` tool).

- For each lesson/concept:
  - Use `explainer` or other interactive teaching tools to introduce the concept,
  - Use practice tools (`multiple-choice`, `fill-blank`, `drag-drop`, etc.) to reinforce learning,
  - Use assessment tools (`progress-quiz`, `step-solver`, etc.) to check mastery.

- Only advance to the next lesson when the user demonstrates understanding (e.g., passes a quiz or practice).

- At the end of a lesson or subject, summarize progress and suggest next steps.

### 2. Tool Usage

- The AI must always use the `interactive_component` tool for educational content, not just chat.
- The tool type must match the learning stage:
  - `explainer` for new concepts,
  - `interactive-example` for demonstrations,
  - `multiple-choice`, `fill-blank`, `drag-drop` for practice,
  - `progress-quiz`, `step-solver` for assessment.
- The AI must use `clarifying_question` if the user's input is ambiguous.
- The AI must use `lesson_complete` and `next_lesson` tools to track and advance progress.

### 3. Context Retention

- The AI must always include the current subject, lesson, and progress in its context for every tool call and response.
- The AI must update context after every user interaction, lesson completion, or assessment.
- The AI must persist context across sessions (if possible).

## Non-Functional Requirements

- **Accessibility:** All interactive components must be accessible (keyboard, screen reader, color contrast).
- **Performance:** Interactive components must load quickly and not block the UI.
- **Reliability:** The AI must never "forget" context or lose track of the lesson flow.

## Technical Notes

- Reference and update:
  - `@ai-tutor-service.ts`: Ensure tool call logic, context management, and pedagogical flow are enforced.
  - `@useAITutor.ts`: Ensure context is always passed and updated, and tool calls are handled correctly.
  - `@StreamPane.tsx`, `@ChatMessageList.tsx`, `@interactive`: Ensure UI reflects the pedagogical flow and context.
- Add/expand tests to cover:
  - Lesson plan creation,
  - Interactive component generation,
  - Progression logic,
  - Context retention across tool calls and sessions.

## Success Metrics

- 95%+ of educational responses use interactive components (not just chat).
- Users complete lessons in a structured, progressive flow.
- No context loss or "reset" during a session.
- User feedback indicates improved clarity, engagement, and learning outcomes.

---

**Next Steps:**  
- Review and align backend (AI logic, tool call enforcement) and frontend (UI, state management) to this PRD.
- Implement and test the improved pedagogical flow, tool usage, and context retention.
- Validate with user testing and iterate. 