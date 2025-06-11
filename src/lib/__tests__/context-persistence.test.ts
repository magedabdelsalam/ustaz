import { AITutorService, TutorContext } from '../ai-tutor-service'
import { persistenceService } from '../persistenceService'
import { Subject, LessonPlan, Lesson } from '@/types'

jest.mock('../persistenceService')

describe('Context Persistence', () => {
  let tutorService: AITutorService
  const mockUserId = 'test-user-id'
  const mockSubjectId = 'test-subject-id'

  beforeEach(() => {
    tutorService = new AITutorService()
    tutorService.setCurrentUser(mockUserId)
    jest.clearAllMocks()
  })

  it('saves context to persistence service', async () => {
    const context: TutorContext = {
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
      },
      lessonPlan: {
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
      },
      conversationHistory: []
    }

    tutorService.updateContext(context)
    await tutorService.loadContextForSubject(mockSubjectId)

    expect(persistenceService.saveTutorContext).toHaveBeenCalledWith(
      mockUserId,
      mockSubjectId,
      expect.objectContaining({
        subject: expect.objectContaining({
          id: mockSubjectId,
          name: 'Mathematics'
        }),
        lessonPlan: expect.objectContaining({
          subject: 'Mathematics',
          currentLessonIndex: 0
        })
      })
    )
  })

  it('loads context from persistence service', async () => {
    const mockContext: TutorContext = {
      subject: {
        id: mockSubjectId,
        name: 'Mathematics',
        progress: 50,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['algebra'],
        messageCount: 10,
        lastActive: new Date()
      },
      lessonPlan: {
        subject: 'Mathematics',
        currentLessonIndex: 1,
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
      },
      conversationHistory: []
    }

    ;(persistenceService.loadTutorContext as jest.Mock).mockResolvedValueOnce(mockContext)

    await tutorService.loadContextForSubject(mockSubjectId)
    const loadedContext = tutorService.getContext()

    expect(loadedContext.subject).toEqual(mockContext.subject)
    expect(loadedContext.lessonPlan).toEqual(mockContext.lessonPlan)
    expect(persistenceService.loadTutorContext).toHaveBeenCalledWith(
      mockUserId,
      mockSubjectId
    )
  })

  it('handles failed context load gracefully', async () => {
    ;(persistenceService.loadTutorContext as jest.Mock).mockRejectedValueOnce(new Error('Failed to load context'))

    await tutorService.loadContextForSubject(mockSubjectId)
    const context = tutorService.getContext()

    expect(context.subject).toBeUndefined()
    expect(context.lessonPlan).toBeUndefined()
    expect(context.conversationHistory).toHaveLength(0)
  })

  it('maintains context across subject switches', async () => {
    const initialContext: TutorContext = {
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
      },
      lessonPlan: {
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
      },
      conversationHistory: []
    }

    tutorService.updateContext(initialContext)
    await tutorService.loadContextForSubject(mockSubjectId)

    const newSubjectId = 'new-subject-id'
    const newContext: TutorContext = {
      subject: {
        id: newSubjectId,
        name: 'Physics',
        progress: 0,
        color: '#000000',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: ['mechanics'],
        messageCount: 0,
        lastActive: new Date()
      },
      lessonPlan: {
        subject: 'Physics',
        currentLessonIndex: 0,
        lessons: [
          {
            id: 'lesson-1',
            title: 'Introduction to Mechanics',
            description: 'Learn the basics of classical mechanics',
            completed: false
          }
        ]
      },
      conversationHistory: []
    }

    ;(persistenceService.loadTutorContext as jest.Mock).mockResolvedValueOnce(newContext)

    await tutorService.loadContextForSubject(newSubjectId)
    const loadedContext = tutorService.getContext()

    expect(loadedContext.subject?.id).toBe(newSubjectId)
    expect(loadedContext.subject?.name).toBe('Physics')
    expect(loadedContext.lessonPlan?.subject).toBe('Physics')
  })

  it('cleans up context on reset', async () => {
    const context: TutorContext = {
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
      },
      lessonPlan: {
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
      },
      conversationHistory: []
    }

    tutorService.updateContext(context)
    tutorService.reset()

    const resetContext = tutorService.getContext()
    expect(resetContext.subject).toBeUndefined()
    expect(resetContext.lessonPlan).toBeUndefined()
    expect(resetContext.conversationHistory).toHaveLength(0)
  })
}) 