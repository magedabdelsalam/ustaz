import { Subject } from '@/hooks/useSubjects'
import { LessonPlan, LearningProgress, Lesson } from '@/lib/aiService'
import { PersistedSubject } from '@/lib/persistenceService'

type ExtendedProgress = LearningProgress & {
  currentLessonIndex?: number
  totalLessons?: number
}

/**
 * Convert a Subject to the PersistedSubject structure used by
 * the persistence service. Optional overrides allow callers to
 * supply a different lesson plan, progress or lastActive time.
 */
export function buildPersistedSubject(
  userId: string,
  subject: Subject,
  overrides?: {
    lessonPlan?: LessonPlan
    progress?: LearningProgress
    lastActive?: Date
  }
): PersistedSubject {
  const plan: LessonPlan | undefined = overrides?.lessonPlan ?? subject.lessonPlan
  const progress: ExtendedProgress | undefined =
    overrides?.progress ?? (subject.learningProgress as ExtendedProgress | undefined)

  const lessonPlanData = plan
    ? {
        subject: subject.name,
        lessons: plan.lessons.map((lesson: Lesson) => ({
          ...lesson,
          completed: false,
        })),
        currentLessonIndex: plan.currentLessonIndex,
      }
    : undefined

  const learningProgressData = progress
    ? {
        correctAnswers: progress.correctAnswers,
        totalAttempts: progress.totalAttempts,
        needsReview: progress.needsReview ?? false,
        readyForNext: progress.readyForNext ?? false,
        currentLessonIndex: progress.currentLessonIndex,
        totalLessons: progress.totalLessons,
      }
    : undefined

  return {
    id: subject.id,
    user_id: userId,
    name: subject.name,
    keywords: subject.topicKeywords,
    lesson_plan: lessonPlanData,
    learning_progress: learningProgressData,
    last_active: (overrides?.lastActive ?? subject.lastActive).toISOString(),
  }
}
