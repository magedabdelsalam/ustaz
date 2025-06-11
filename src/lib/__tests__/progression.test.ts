import { AITutorService } from '../ai-tutor-service'
import { LessonPlan, LearningProgress } from '@/types'

describe('Lesson Progression Logic', () => {
  let tutorService: AITutorService
  const mockUserId = 'test-user-id'
  const mockSubjectId = 'test-subject-id'

  beforeEach(() => {
    tutorService = new AITutorService()
    tutorService.setCurrentUser(mockUserId)
  })

  it('requires passing assessment before advancing', async () => {
    const lessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: false
        },
        {
          id: 'lesson-2',
          title: 'Linear Equations',
          description: 'Master solving linear equations',
          completed: false
        }
      ]
    }

    const learningProgress: LearningProgress = {
      correctAnswers: 2,
      totalAttempts: 5,
      needsReview: true,
      readyForNext: false
    }

    tutorService.updateContext({ lessonPlan, learningProgress })

    const response = await tutorService.generateResponse('I want to move to the next lesson', {
      subject: {
        id: mockSubjectId,
        name: 'Mathematics',
        progress: 0,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['algebra'],
        messageCount: 0,
        lastActive: new Date()
      }
    })

    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'clarifying_question',
        parameters: expect.objectContaining({
          question: expect.stringContaining('assessment'),
          context: expect.stringContaining('understanding')
        })
      })
    )
  })

  it('allows progression after passing assessment', async () => {
    const lessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: false
        },
        {
          id: 'lesson-2',
          title: 'Linear Equations',
          description: 'Master solving linear equations',
          completed: false
        }
      ]
    }

    const learningProgress: LearningProgress = {
      correctAnswers: 8,
      totalAttempts: 10,
      needsReview: false,
      readyForNext: true
    }

    tutorService.updateContext({ lessonPlan, learningProgress })

    const response = await tutorService.generateResponse('I want to move to the next lesson', {
      subject: {
        id: mockSubjectId,
        name: 'Mathematics',
        progress: 0,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['algebra'],
        messageCount: 0,
        lastActive: new Date()
      }
    })

    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'lesson_complete',
        parameters: expect.objectContaining({
          lesson_id: 'lesson-1',
          completed: true
        })
      })
    )

    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'next_lesson',
        parameters: expect.objectContaining({
          current_lesson_id: 'lesson-1'
        })
      })
    )
  })

  it('suggests review when performance is below threshold', async () => {
    const lessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: false
        }
      ]
    }

    const learningProgress: LearningProgress = {
      correctAnswers: 3,
      totalAttempts: 10,
      needsReview: true,
      readyForNext: false
    }

    tutorService.updateContext({ lessonPlan, learningProgress })

    const response = await tutorService.generateResponse('I want to move to the next lesson', {
      subject: {
        id: mockSubjectId,
        name: 'Mathematics',
        progress: 0,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['algebra'],
        messageCount: 0,
        lastActive: new Date()
      }
    })

    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'review_request',
        parameters: expect.objectContaining({
          topics: expect.arrayContaining(['algebra']),
          review_type: 'comprehensive'
        })
      })
    )
  })

  it('adapts difficulty based on performance', async () => {
    const lessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: false
        }
      ]
    }

    const learningProgress: LearningProgress = {
      correctAnswers: 1,
      totalAttempts: 5,
      needsReview: true,
      readyForNext: false
    }

    tutorService.updateContext({ lessonPlan, learningProgress })

    const response = await tutorService.generateResponse('I find this too difficult', {
      subject: {
        id: mockSubjectId,
        name: 'Mathematics',
        progress: 0,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['algebra'],
        messageCount: 0,
        lastActive: new Date()
      }
    })

    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'update_lesson_plan',
        parameters: expect.objectContaining({
          reason: expect.stringContaining('difficulty'),
          adjustments: expect.arrayContaining([
            expect.stringContaining('simplify')
          ])
        })
      })
    )
  })

  it('provides summary and next steps at lesson completion', async () => {
    const lessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: true
        },
        {
          id: 'lesson-2',
          title: 'Linear Equations',
          description: 'Master solving linear equations',
          completed: false
        }
      ]
    }

    const learningProgress: LearningProgress = {
      correctAnswers: 9,
      totalAttempts: 10,
      needsReview: false,
      readyForNext: true
    }

    tutorService.updateContext({ lessonPlan, learningProgress })

    const response = await tutorService.generateResponse('What did I learn and what\'s next?', {
      subject: {
        id: mockSubjectId,
        name: 'Mathematics',
        progress: 0,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['algebra'],
        messageCount: 0,
        lastActive: new Date()
      }
    })

    expect(response.toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'summary_request',
        parameters: expect.objectContaining({
          content_type: 'lesson',
          scope: 'lesson-1',
          includeNextSteps: true
        })
      })
    )
  })
}) 