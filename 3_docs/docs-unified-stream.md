# Unified Stream Architecture Documentation

## Overview
The unified stream architecture combines chat messages and interactive lesson components into a single chronological feed (`StreamPane`). This enables a seamless, lesson-driven, and feedback-rich learning experience.

## Architecture
- **StreamPane**: Renders a chronological feed of both chat messages and interactive lesson components.
- **StreamItem**: Unified type for both messages and interactive content, with timestamp-based ordering.
- **HistoryPane**: Sidebar for subject creation and selection. Subject creation is only possible here.
- **Dashboard**: Wires together subject selection, stream state, and persistence.
- **Persistence**: Messages and interactive content are loaded/saved per subject using Supabase.

## Key Components
- `src/components/StreamPane.tsx`: Main unified stream component.
- `src/components/HistoryPane.tsx`: Sidebar for subject management.
- `src/components/interactive/`: All interactive lesson components (MultipleChoice, FillInTheBlank, etc.).
- `src/components/Dashboard.tsx`: Main dashboard, manages stream state and subject flow.
- `src/hooks/useSubjectSession.ts`: Loads/saves messages for the selected subject.

## Accessibility & UX
- ARIA roles (`feed`, `article`, `form`) and live regions for screen readers.
- Keyboard navigation and focus management throughout.
- Color contrast and responsive design (WCAG 2.1 AA).
- Animated transitions (framer-motion) and instant feedback (sonner toasts).
- Pinned chat input at the bottom of the stream.

## Testing
- Unit and integration tests for all major components (StreamPane, HistoryPane, Dashboard, interactive types).
- Defensive checks for missing/invalid data in all interactive components.
- Accessibility and keyboard navigation tested via Jest and manual QA.

## Deployment Notes
- Deploy on Vercel for Next.js, with environment variables for Supabase.
- Supabase RLS enabled for all tables.
- All environment variables and secrets managed via `.env.local` and Vercel dashboard.

## References
- See `tasks/tasks-unified-stream.md` for the full PRD and task breakdown.
- See `README.md` for project setup and deployment instructions. 