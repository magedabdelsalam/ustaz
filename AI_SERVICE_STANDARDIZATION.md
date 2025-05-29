# AI Service Standardization Guide

This document outlines conventions for using `src/lib/aiService.ts` so that all developers interact with the AI in a consistent manner.

## Overview
`aiService.ts` exposes the `aiTutor` instance which orchestrates OpenAI requests, caching, progress tracking and fallback generation. Following the same patterns across the codebase ensures predictable behaviour and easier maintenance.

## General Principles
- **Single Entry Point**: Use the exported `aiTutor` instance from `@/lib/aiService` instead of creating new service objects elsewhere.
- **Structured Prompts**: Each API call should follow the same message structure:
  1. A system message describing the tutor role.
  2. A user message providing the action prompt.
- **Caching**: All public methods rely on the internal `cachedApiCall()` wrapper. Do not bypass this mechanism – it keeps requests efficient.
- **Throttling**: The service automatically spaces out API calls through `throttleApiCall()`. Avoid additional artificial delays in components.

## Recommended Usage
1. **Lesson Plan Creation**
   ```typescript
   const plan = await aiTutor.createLearningPlan(subjectName)
   const progress = aiTutor.getProgress(subjectName)
   ```
2. **Generating Lesson Content**
   ```typescript
   const lessonContent = await aiTutor.generateLessonContent(
     subjectName,
     currentLesson.id,
     'multiple-choice'
   )
   ```
3. **Tutor Responses**
   ```typescript
   const reply = await aiTutor.generateTutorResponse(
     subjectName,
     'help_requested',
     { question: userQuestion },
     { lesson: currentLesson, progress }
   )
   ```
4. **Updating Progress**
   ```typescript
   const updated = aiTutor.updateProgress(subjectName, isCorrect, currentLesson.id)
   ```

## Error Handling
Every method in `aiService.ts` returns either the requested data or a fallback. Components should assume the method succeeds and only log errors if the returned value is `null` or clearly invalid. Avoid try/catch around individual calls unless additional context is required.

## Extending the Service
- Place new API interactions inside `AITutorService` so they benefit from caching and throttling.
- Keep prompt creation logic in small helper methods (e.g., `createTutorResponsePrompt`).
- Always add a fallback to handle API failure.

Following these guidelines keeps our AI interactions predictable and reduces token usage while maintaining high quality responses.
