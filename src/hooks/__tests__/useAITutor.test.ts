import { renderHook, act } from '@testing-library/react'
import { useAITutor } from '../useAITutor'
import { AppError } from '@/types'

// Mock the useAITutorService
jest.mock('@/services/ai-tutor', () => ({
  useAITutorService: () => ({
    generateResponse: jest.fn(),
    updateContext: jest.fn(),
    getContext: jest.fn(),
    setCurrentUser: jest.fn()
  })
}))

describe('useAITutor', () => {
  const mockOnError = jest.fn()
  const mockOnLoadingChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('handles successful message sending', async () => {
    const mockResponse = {
      response: 'AI response',
      toolCalls: [],
      updatedContext: {}
    }

    // Mock the service response
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn().mockResolvedValue(mockResponse),
      updateContext: jest.fn(),
      getContext: jest.fn(),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockOnError).not.toHaveBeenCalled()
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles message sending error', async () => {
    const mockError = new Error('Network error')

    // Mock the service error
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn().mockRejectedValue(mockError),
      updateContext: jest.fn(),
      getContext: jest.fn(),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      await expect(result.current.sendMessage('Hello')).rejects.toThrow('Network error')
    })

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles successful interaction', async () => {
    const mockResponse = {
      response: 'Interaction response',
      toolCalls: [],
      updatedContext: {}
    }

    // Mock the service response
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn().mockResolvedValue(mockResponse),
      updateContext: jest.fn(),
      getContext: jest.fn(),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      await result.current.handleInteraction('test', { data: 'test' })
    })

    expect(mockOnError).not.toHaveBeenCalled()
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles interaction error', async () => {
    const mockError = new Error('Invalid interaction')

    // Mock the service error
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn().mockRejectedValue(mockError),
      updateContext: jest.fn(),
      getContext: jest.fn(),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      await expect(result.current.handleInteraction('test', { data: 'test' })).rejects.toThrow('Invalid interaction')
    })

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles successful lesson plan retrieval', async () => {
    const mockLessonPlan = {
      subject: 'Math',
      currentLessonIndex: 0,
      lessons: []
    }

    // Mock the service response
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn(),
      updateContext: jest.fn(),
      getContext: jest.fn().mockReturnValue({ lessonPlan: mockLessonPlan }),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      const lessonPlan = await result.current.getLessonPlan()
      expect(lessonPlan).toEqual(mockLessonPlan)
    })

    expect(mockOnError).not.toHaveBeenCalled()
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles lesson plan retrieval error', async () => {
    const mockError = new Error('Failed to load lesson plan')

    // Mock the service error
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn(),
      updateContext: jest.fn(),
      getContext: jest.fn().mockRejectedValue(mockError),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      await expect(result.current.getLessonPlan()).rejects.toThrow('Failed to load lesson plan')
    })

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles successful current lesson retrieval', async () => {
    const mockCurrentLesson = {
      title: 'Introduction',
      description: 'Lesson description',
      progress: 0
    }

    // Mock the service response
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn(),
      updateContext: jest.fn(),
      getContext: jest.fn().mockReturnValue({ currentLesson: mockCurrentLesson }),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      const currentLesson = await result.current.getCurrentLesson()
      expect(currentLesson).toEqual(mockCurrentLesson)
    })

    expect(mockOnError).not.toHaveBeenCalled()
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })

  it('handles current lesson retrieval error', async () => {
    const mockError = new Error('Failed to load current lesson')

    // Mock the service error
    jest.requireMock('@/services/ai-tutor').useAITutorService.mockReturnValue({
      generateResponse: jest.fn(),
      updateContext: jest.fn(),
      getContext: jest.fn().mockRejectedValue(mockError),
      setCurrentUser: jest.fn()
    })

    const { result } = renderHook(() => useAITutor({
      onError: mockOnError,
      onLoadingChange: mockOnLoadingChange
    }))

    await act(async () => {
      await expect(result.current.getCurrentLesson()).rejects.toThrow('Failed to load current lesson')
    })

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
  })
}) 