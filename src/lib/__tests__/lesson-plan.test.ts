import { AITutorService } from '../ai-tutor-service'
import { LessonPlan, Lesson } from '@/types'

describe('Lesson Plan Management', () => {
  let tutorService: AITutorService
  const mockUserId = 'test-user-id'
  const mockSubjectId = 'test-subject-id'

  beforeEach(() => {
    tutorService = new AITutorService()
    tutorService.setCurrentUser(mockUserId)
  })

  it('creates a new lesson plan with proper structure', async () => {
    const mockLessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: false,
          objectives: [
            'Understand basic algebraic terms',
            'Solve simple equations',
            'Apply algebraic concepts to real-world problems'
          ]
        },
        {
          id: 'lesson-2',
          title: 'Linear Equations',
          description: 'Master solving linear equations',
          completed: false,
          objectives: [
            'Identify linear equations',
            'Solve linear equations with one variable',
            'Graph linear equations'
          ]
        }
      ]
    }

    const response = await tutorService.generateResponse('Create a lesson plan for Algebra', {
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
        name: 'new_lesson_plan',
        parameters: expect.objectContaining({
          subject: 'Mathematics',
          difficulty_level: expect.any(String),
          learning_goals: expect.any(Array)
        })
      })
    )
  })

  it('updates lesson plan based on user progress', async () => {
    const initialLessonPlan: LessonPlan = {
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

    tutorService.updateContext({ lessonPlan: initialLessonPlan })

    const response = await tutorService.generateResponse('I find this lesson too difficult', {
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
          reason: expect.any(String),
          adjustments: expect.any(Array)
        })
      })
    )
  })

  it('marks lesson as complete and advances to next lesson', async () => {
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

    tutorService.updateContext({ lessonPlan })

    const response = await tutorService.generateResponse('I have completed the first lesson', {
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

  it('generates summary at the end of a lesson', async () => {
    const lessonPlan: LessonPlan = {
      subject: 'Mathematics',
      currentLessonIndex: 0,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions',
          completed: true
        }
      ]
    }

    tutorService.updateContext({ lessonPlan })

    const response = await tutorService.generateResponse('What did I learn in this lesson?', {
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
          scope: 'lesson-1'
        })
      })
    )
  })
}) 