# Unified Stream & Subject Creation PRD

## Goal
- **Unify ChatPane and ContentPane** into a single "Stream" where the AI both chats and progresses the user through lessons, using interactive components for teaching and feedback.
- **Move subject creation** to a dedicated input in the HistoryPane. No more subject creation or rerouting in the chat input.

---

## Plan

### 1. Create a New `StreamPane` Component
- Replace both `ChatPane` and `ContentPane`.
- The stream will:
  - Show a chronological feed of both chat messages and interactive content (from the AI and user).
  - Allow the user to send messages, answer questions, and interact with components in one place.
  - Render all interactive components dynamically (using the pattern from `ContentPane` and `interactive/index.ts`).
  - Handle AI feedback, lesson progression, and user answers in the same stream.

### 2. Refactor Subject Creation
- Remove all subject creation logic from `ChatPane` and the AI input.
- Add a subject creation input (text field + button) to the top of `HistoryPane`.
- On submit, call `createSubject` from `useSubjects`, then select the new subject.

### 3. Update Dashboard Wiring
- Remove all event listeners and rerouting logic for subject creation from the chat stream.
- Pass the new subject creation handler to `HistoryPane`.
- Only allow subject selection/creation from `HistoryPane`.

### 4. Remove Old Components
- Delete `ChatPane.tsx` and `ContentPane.tsx` after migration.
- Update all imports/usages to use the new `StreamPane`.

### 5. Testing & UX
- Ensure the new stream supports all previous interactive types.
- Test subject creation, selection, and stream progression.
- Ensure accessibility and responsive design.

---

## Next Steps
1. **Create `StreamPane.tsx`** in `src/components/`.
2. **Add subject creation input** to `HistoryPane.tsx`.
3. **Update `Dashboard.tsx`** to use the new components and remove old logic.
4. **Remove `ChatPane.tsx` and `ContentPane.tsx`**.

---

## Notes
- All interactive types from `src/components/interactive/` must be supported in the new stream.
- Subject creation is now a dedicated, user-driven action in the sidebar/history, not AI-driven or implicit.
- The stream should provide a seamless, lesson-driven, and feedback-rich experience. 