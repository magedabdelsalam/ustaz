## Relevant Files

- `src/components/StreamPane.tsx` - Main unified stream component for chat and interactive content.
- `src/components/__tests__/StreamPane.test.tsx` - Unit tests for StreamPane.
- `src/components/HistoryPane.tsx` - Sidebar for subject selection and creation (to be updated).
- `src/components/__tests__/HistoryPane.test.tsx` - Unit tests for HistoryPane.
- `src/components/Dashboard.tsx` - Main dashboard, to wire up the new stream and subject flow.
- `src/components/__tests__/Dashboard.subjects.test.tsx` - Integration tests for Dashboard subject flow.
- `src/components/history/ContentHistorySidebar.tsx` - History sidebar, now imports InteractiveContent from types and handles optional timestamp.
- `src/hooks/useSubjects.ts` - Subject creation and management logic.
- `src/types/index.ts` - Type definitions for messages, subjects, and interactive content.
- `src/components/interactive/index.ts` - Exports all interactive components for dynamic rendering.
- `src/lib/persistenceService.ts` - Handles persistence for messages, subjects, and content.

### Notes

- Place unit tests alongside the code files they are testing (e.g., `StreamPane.tsx` and `StreamPane.test.tsx`).
- Use `npx jest` to run all tests or `npx jest path/to/test/file` for a specific test file.
- Remove old components only after the new stream is fully functional and tested.

## Tasks

- [x] 1.0 Create a Unified `StreamPane` Component
  - [x] 1.1 Design the data structure for a unified stream (messages + interactive content).
  - [x] 1.2 Implement the `StreamPane` component to render a chronological feed of chat and interactive items.
  - [x] 1.3 Integrate all interactive components using dynamic imports from `interactive/index.ts`.
  - [x] 1.4 Implement user input for chat/messages and interaction handling in the stream.
  - [x] 1.5 Ensure AI feedback and lesson progression are handled in the same stream.
  - [x] 1.6 Write unit tests for `StreamPane`.

- [x] 2.0 Refactor Subject Creation to HistoryPane
  - [x] 2.1 Remove subject creation logic from `ChatPane` and AI input.
  - [x] 2.2 Add a subject creation input (text field + button) to the top of `HistoryPane`.
  - [x] 2.3 Wire the input to call `createSubject` from `useSubjects` and select the new subject.
  - [x] 2.4 Update UI/UX for subject creation and selection in the sidebar.
  - [x] 2.5 Write unit tests for subject creation in `HistoryPane`.

- [x] 3.0 Update Dashboard Wiring for New Stream and Subject Flow
  - [x] 3.1 Remove event listeners and rerouting logic for subject creation from the chat stream.
  - [x] 3.2 Pass the new subject creation handler to `HistoryPane`.
  - [x] 3.3 Update Dashboard to use `StreamPane` instead of `ChatPane` and `ContentPane`.
  - [x] 3.4 Ensure only subject selection/creation from `HistoryPane` is possible.
  - [x] 3.5 Test the new wiring for correct subject flow.

- [x] 4.0 Remove Old Components and Update Imports
  - [x] 4.1 Delete `ChatPane.tsx` and `ContentPane.tsx` after migration.
  - [x] 4.2 Update all imports/usages to use the new `StreamPane`.
  - [x] 4.3 Remove any obsolete types, props, or event logic related to the old components.

- [x] 5.0 Test, Polish UX, and Ensure Accessibility
  - [x] 5.1 Test the new stream for all interactive types and user flows.
  - [x] 5.2 Ensure accessibility (keyboard navigation, ARIA, color contrast, etc.).
  - [x] 5.3 Polish UI/UX for a seamless, lesson-driven, and feedback-rich experience.
  - [x] 5.4 Update or add documentation as needed. 