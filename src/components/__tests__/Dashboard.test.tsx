import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Dashboard } from '../Dashboard'
import { AppError } from '@/types'

// Mock the useAITutor hook
jest.mock('@/hooks/useAITutor', () => ({
  useAITutor: () => ({
    sendMessage: jest.fn(),
    handleInteraction: jest.fn(),
    getLessonPlan: jest.fn(),
    getCurrentLesson: jest.fn(),
    isLoading: false,
    error: null,
    onError: jest.fn(),
    onLoadingChange: jest.fn()
  })
}))

// Mock the useSubjects hook
jest.mock('@/hooks/useSubjects', () => ({
  useSubjects: () => ({
    subjects: [
      {
        id: '1',
        name: 'Math',
        progress: 0,
        color: 'bg-blue-500',
        isActive: true,
        startedAt: new Date(),
        topicKeywords: [],
        messageCount: 0,
        lastActive: new Date()
      }
    ],
    currentSubject: {
      id: '1',
      name: 'Math',
      progress: 0,
      color: 'bg-blue-500',
      isActive: true,
      startedAt: new Date(),
      topicKeywords: [],
      messageCount: 0,
      lastActive: new Date()
    },
    selectSubject: jest.fn(),
    createSubject: jest.fn(),
    deleteSubject: jest.fn()
  })
}))

describe('Dashboard', () => {
  it('shows loading state when initializing', () => {
    // Override the useAITutor mock for this test
    jest.requireMock('@/hooks/useAITutor').useAITutor.mockReturnValue({
      sendMessage: jest.fn(),
      handleInteraction: jest.fn(),
      getLessonPlan: jest.fn(),
      getCurrentLesson: jest.fn(),
      isLoading: true,
      error: null,
      onError: jest.fn(),
      onLoadingChange: jest.fn()
    })

    render(<Dashboard />)
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
  })

  it('shows error state and retry button', async () => {
    const mockError: AppError = {
      message: 'Failed to load lesson plan',
      userMessage: 'A test error occurred.',
      canRetry: false,
      timestamp: new Date(),
      severity: 'error',
      type: 'unknown',
    }

    // Override the useAITutor mock for this test
    jest.requireMock('@/hooks/useAITutor').useAITutor.mockReturnValue({
      sendMessage: jest.fn(),
      handleInteraction: jest.fn(),
      getLessonPlan: jest.fn(),
      getCurrentLesson: jest.fn(),
      isLoading: false,
      error: mockError,
      onError: jest.fn(),
      onLoadingChange: jest.fn()
    })

    render(<Dashboard />)
    
    expect(screen.getByText('Failed to load lesson plan')).toBeInTheDocument()
    expect(screen.getByText('A test error occurred.')).toBeInTheDocument()
    
    const retryButton = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryButton)
    
    // Verify that getLessonPlan and getCurrentLesson were called
    await waitFor(() => {
      const { getLessonPlan, getCurrentLesson } = jest.requireMock('@/hooks/useAITutor').useAITutor()
      expect(getLessonPlan).toHaveBeenCalled()
      expect(getCurrentLesson).toHaveBeenCalled()
    })
  })

  it('handles message sending with loading state', async () => {
    const mockSendMessage = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    // Override the useAITutor mock for this test
    jest.requireMock('@/hooks/useAITutor').useAITutor.mockReturnValue({
      sendMessage: mockSendMessage,
      handleInteraction: jest.fn(),
      getLessonPlan: jest.fn(),
      getCurrentLesson: jest.fn(),
      isLoading: false,
      error: null,
      onError: jest.fn(),
      onLoadingChange: jest.fn()
    })

    render(<Dashboard />)
    
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

  it('handles interaction errors', async () => {
    const mockError: AppError = {
      message: 'Failed to process interaction',
      userMessage: 'A test error occurred.',
      canRetry: false,
      timestamp: new Date(),
      severity: 'error',
      type: 'unknown',
    }
    
    const mockHandleInteraction = jest.fn().mockRejectedValue(mockError)
    
    // Override the useAITutor mock for this test
    jest.requireMock('@/hooks/useAITutor').useAITutor.mockReturnValue({
      sendMessage: jest.fn(),
      handleInteraction: mockHandleInteraction,
      getLessonPlan: jest.fn(),
      getCurrentLesson: jest.fn(),
      isLoading: false,
      error: null,
      onError: jest.fn(),
      onLoadingChange: jest.fn()
    })

    render(<Dashboard />)
    
    // Simulate an interaction
    const { handleInteraction } = jest.requireMock('@/hooks/useAITutor').useAITutor()
    await handleInteraction('test', { data: 'test' })
    
    expect(screen.getByText('Failed to process interaction')).toBeInTheDocument()
    expect(screen.getByText('A test error occurred.')).toBeInTheDocument()
  })

  it('handles lesson plan loading errors', async () => {
    const mockError: AppError = {
      message: 'Failed to load lesson plan',
      userMessage: 'A test error occurred.',
      canRetry: false,
      timestamp: new Date(),
      severity: 'error',
      type: 'unknown',
    }
    
    const mockGetLessonPlan = jest.fn().mockRejectedValue(mockError)
    
    // Override the useAITutor mock for this test
    jest.requireMock('@/hooks/useAITutor').useAITutor.mockReturnValue({
      sendMessage: jest.fn(),
      handleInteraction: jest.fn(),
      getLessonPlan: mockGetLessonPlan,
      getCurrentLesson: jest.fn(),
      isLoading: false,
      error: null,
      onError: jest.fn(),
      onLoadingChange: jest.fn()
    })

    render(<Dashboard />)
    
    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to load lesson plan')).toBeInTheDocument()
      expect(screen.getByText('A test error occurred.')).toBeInTheDocument()
    })
  })
}) 