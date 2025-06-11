import { AITutorService } from '../ai-tutor-service'
import { ComponentType, InteractiveContent } from '@/types'

describe('Interactive Component Generation', () => {
  let tutorService: AITutorService
  const mockUserId = 'test-user-id'
  const mockSubjectId = 'test-subject-id'

  beforeEach(() => {
    tutorService = new AITutorService()
    tutorService.setCurrentUser(mockUserId)
  })

  it('generates multiple choice question', async () => {
    const response = await tutorService.generateResponse('Give me a multiple choice question about algebra', {
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
        name: 'interactive_component',
        parameters: expect.objectContaining({
          type: 'multiple-choice',
          content: expect.objectContaining({
            question: expect.any(String),
            choices: expect.arrayContaining([
              expect.objectContaining({
                text: expect.any(String),
                isCorrect: expect.any(Boolean)
              })
            ])
          }),
          learning_objective: expect.any(String)
        })
      })
    )
  })

  it('generates fill in the blank exercise', async () => {
    const response = await tutorService.generateResponse('Give me a fill in the blank exercise about equations', {
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
        name: 'interactive_component',
        parameters: expect.objectContaining({
          type: 'fill-blank',
          content: expect.objectContaining({
            question: expect.any(String),
            template: expect.any(String),
            answers: expect.any(Array)
          }),
          learning_objective: expect.any(String)
        })
      })
    )
  })

  it('generates step by step solver', async () => {
    const response = await tutorService.generateResponse('Show me how to solve a quadratic equation step by step', {
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
        name: 'interactive_component',
        parameters: expect.objectContaining({
          type: 'step-solver',
          content: expect.objectContaining({
            problem: expect.any(String),
            steps: expect.arrayContaining([
              expect.objectContaining({
                title: expect.any(String),
                content: expect.any(String)
              })
            ])
          }),
          learning_objective: expect.any(String)
        })
      })
    )
  })

  it('generates concept card', async () => {
    const response = await tutorService.generateResponse('Explain the concept of variables in algebra', {
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
        name: 'interactive_component',
        parameters: expect.objectContaining({
          type: 'concept-card',
          content: expect.objectContaining({
            title: expect.any(String),
            summary: expect.any(String),
            details: expect.any(String),
            keyPoints: expect.any(Array),
            examples: expect.any(Array)
          }),
          learning_objective: expect.any(String)
        })
      })
    )
  })

  it('generates interactive example', async () => {
    const response = await tutorService.generateResponse('Show me an interactive example of solving equations', {
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
        name: 'interactive_component',
        parameters: expect.objectContaining({
          type: 'interactive-example',
          content: expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
            controls: expect.any(Array),
            display: expect.any(Array),
            explanation: expect.any(String)
          }),
          learning_objective: expect.any(String)
        })
      })
    )
  })

  it('generates progress quiz', async () => {
    const response = await tutorService.generateResponse('Give me a quiz to test my understanding', {
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
        name: 'interactive_component',
        parameters: expect.objectContaining({
          type: 'progress-quiz',
          content: expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
            questions: expect.arrayContaining([
              expect.objectContaining({
                text: expect.any(String),
                options: expect.any(Array)
              })
            ])
          }),
          learning_objective: expect.any(String)
        })
      })
    )
  })
}) 