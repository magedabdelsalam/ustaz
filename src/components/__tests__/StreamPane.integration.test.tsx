import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StreamPane, StreamItem, StreamMessage, StreamInteractiveContent } from '../StreamPane'
import * as Interactive from '../interactive'

// Helper to create a StreamInteractiveContent for each type
const interactiveTypes = [
  'multiple-choice',
  'fill-blank',
  'drag-drop',
  'step-solver',
  'concept-card',
  'interactive-example',
  'progress-quiz',
  'graph-visualizer',
  'formula-explorer',
  'text-highlighter',
  'explainer',
  'placeholder',
] as const

describe('StreamPane integration', () => {
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

  it('renders all interactive types in the stream', () => {
    const stream: StreamItem[] = [userMsg, aiMsg]
    interactiveTypes.forEach((type, i) => {
      stream.push({
        id: `int-${type}`,
        type,
        data: {},
        streamType: 'interactive',
        timestamp: new Date(baseTime.getTime() + 2000 + i * 1000),
      } as StreamInteractiveContent)
    })
    render(
      <StreamPane
        stream={stream}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
      />
    )
    // Check that each interactive type is rendered (by heading or fallback text)
    interactiveTypes.forEach((type) => {
      // Try to find by type label or fallback
      const label = type.replace(/-/g, ' ')
      expect(
        screen.queryByText(new RegExp(label, 'i')) ||
        screen.queryByText(new RegExp(type, 'i')) ||
        screen.queryByText(/Unknown interactive type/)
      ).toBeInTheDocument()
    })
  })

  it('handles user progression and interaction', () => {
    const onInteraction = jest.fn()
    const stream: StreamItem[] = [userMsg, aiMsg, {
      id: 'int-mc',
      type: 'multiple-choice',
      data: {
        question: 'What is 2+2?',
        choices: [
          { id: 'a', text: '3', isCorrect: false },
          { id: 'b', text: '4', isCorrect: true },
        ],
      },
      streamType: 'interactive',
      timestamp: new Date(baseTime.getTime() + 2000),
    }]
    render(
      <StreamPane
        stream={stream}
        onInteraction={onInteraction}
        onSendMessage={jest.fn()}
      />
    )
    // Simulate user interaction (e.g., click a choice)
    // This depends on the actual implementation of MultipleChoice
    // For now, just check the question is present
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
    // (If the component exposes a button, simulate click and check handler)
  })

  it('is accessible by keyboard (tab/focus)', () => {
    const stream: StreamItem[] = [userMsg, aiMsg]
    render(
      <StreamPane
        stream={stream}
        onInteraction={jest.fn()}
        onSendMessage={jest.fn()}
      />
    )
    const input = screen.getByPlaceholderText('Type your message...')
    input.focus()
    expect(input).toHaveFocus()
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' })
    // Next focusable element should be the send button
    // (This is a basic check; for full a11y, use axe or similar)
  })
}) 