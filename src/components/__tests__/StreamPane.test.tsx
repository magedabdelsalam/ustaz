import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StreamPane } from '../StreamPane'
import { LessonPlan, AppError, StreamItem, StreamMessage, StreamInteractiveContent } from '@/types'

describe('StreamPane', () => {
  const baseTime = new Date('2024-01-01T12:00:00Z')
  const userMsg: StreamMessage = {
    id: 'user-1',
    role: 'user',
    content: 'Start lesson',
    timestamp: baseTime,
    streamType: 'message',
  }
  const aiMsg: StreamMessage = {
    id: 'ai-1',
    role: 'assistant',
    content: 'Welcome to the lesson!',
    timestamp: new Date(baseTime.getTime() + 1000),
    streamType: 'message',
  }

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
      }
    ]
  }

  const mockCurrentLesson = {
    title: 'Introduction to Algebra',
    description: 'Learn the basics of algebraic expressions',
    progress: 0,
    objectives: [
      'Understand basic algebraic terms',
      'Solve simple equations',
      'Apply algebraic concepts to real-world problems'
    ],
    completedObjectives: []
  }

  const mockError: AppError = {
    message: 'Failed to generate response',
    userMessage: 'A test error occurred.',
    canRetry: false,
    timestamp: new Date(),
    severity: 'error',
    type: 'unknown',
  }

  it('renders lesson progress header when lesson plan and current lesson are provided', () => {
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
      />
    )

    expect(screen.getByText('Introduction to Algebra')).toBeInTheDocument()
    expect(screen.getByText('Learn the basics of algebraic expressions')).toBeInTheDocument()
    expect(screen.getByText('0% Complete')).toBeInTheDocument()
  })

  it('renders learning objectives when available', () => {
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
      />
    )

    expect(screen.getByText('Learning Objectives:')).toBeInTheDocument()
    expect(screen.getByText('Understand basic algebraic terms')).toBeInTheDocument()
    expect(screen.getByText('Solve simple equations')).toBeInTheDocument()
    expect(screen.getByText('Apply algebraic concepts to real-world problems')).toBeInTheDocument()
  })

  it('renders achievement badge when available', () => {
    const lessonWithAchievement = {
      ...mockCurrentLesson,
      achievement: 'Algebra Master'
    }

    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={lessonWithAchievement}
      />
    )

    expect(screen.getByText('Achievement Unlocked!')).toBeInTheDocument()
    expect(screen.getByText('Algebra Master')).toBeInTheDocument()
  })

  it('handles user message input and sending', async () => {
    const onSendMessage = jest.fn()
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={onSendMessage}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
      />
    )

    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByText('Send')

    fireEvent.change(input, { target: { value: 'Hello, AI!' } })
    fireEvent.click(sendButton)

    expect(onSendMessage).toHaveBeenCalledWith('Hello, AI!')
  })

  it('handles clarifying questions', () => {
    const clarifyingMsg: StreamMessage = {
      id: 'ai-2',
      role: 'assistant',
      content: 'Can you clarify what you mean by that?',
      timestamp: new Date(baseTime.getTime() + 2000),
      streamType: 'message',
    }

    render(
      <StreamPane
        stream={[userMsg, clarifyingMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
      />
    )

    expect(screen.getByText('AI needs clarification:')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type your clarification...')).toBeInTheDocument()
  })

  it('is accessible by keyboard', () => {
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
      />
    )

    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByText('Send')

    input.focus()
    expect(input).toHaveFocus()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sendButton).toHaveFocus()
  })

  it('shows loading state when sending message', async () => {
    const onSendMessage = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={onSendMessage}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
      />
    )

    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByText('Send')

    fireEvent.change(input, { target: { value: 'Hello, AI!' } })
    fireEvent.click(sendButton)

    expect(sendButton).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Sending...')

    await waitFor(() => {
      expect(sendButton).not.toBeDisabled()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it('shows error state and retry button', () => {
    const onRetry = jest.fn()
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
        error={mockError}
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('Failed to generate response')).toBeInTheDocument()
    expect(screen.getByText('A test error occurred.')).toBeInTheDocument()
    
    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows loading spinner when initializing', () => {
    render(
      <StreamPane
        stream={[]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
        isLoading={true}
      />
    )

    expect(screen.getByText('Loading conversation...')).toBeInTheDocument()
  })

  it('shows empty state when no messages', () => {
    render(
      <StreamPane
        stream={[]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
        isLoading={false}
      />
    )

    expect(screen.getByText('No messages yet')).toBeInTheDocument()
    expect(screen.getByText('Start a conversation to see messages here.')).toBeInTheDocument()
  })

  it('disables input and buttons during loading', () => {
    render(
      <StreamPane
        stream={[userMsg, aiMsg]}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
        lessonPlan={mockLessonPlan}
        currentLesson={mockCurrentLesson}
        isLoading={true}
      />
    )

    const input = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByText('Send')

    expect(input).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })
}) 