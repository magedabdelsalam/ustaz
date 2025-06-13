import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageContextMenu } from '../chat/MessageContextMenu'
import { StreamMessage } from '@/types'

describe('MessageContextMenu', () => {
  const mockMessage: StreamMessage = {
    id: '1',
    role: 'user',
    content: 'Test message',
    timestamp: new Date(),
    streamType: 'message'
  }

  const mockOnDelete = jest.fn()
  const mockOnRetry = jest.fn()

  beforeEach(() => {
    mockOnDelete.mockClear()
    mockOnRetry.mockClear()
  })

  it('renders children correctly', () => {
    render(
      <MessageContextMenu message={mockMessage} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  it('prevents default context menu behavior', () => {
    render(
      <MessageContextMenu message={mockMessage} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    const button = screen.getByText('Test Button')
    const preventDefault = jest.fn()
    fireEvent.contextMenu(button, { preventDefault })
    expect(preventDefault).toHaveBeenCalled()
  })

  it('opens menu on right click', () => {
    render(
      <MessageContextMenu message={mockMessage} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    const button = screen.getByText('Test Button')
    fireEvent.contextMenu(button)
    expect(screen.getByText('Delete Message')).toBeInTheDocument()
  })

  it('calls onDelete when delete option is clicked', () => {
    render(
      <MessageContextMenu message={mockMessage} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    const button = screen.getByText('Test Button')
    fireEvent.contextMenu(button)
    const deleteOption = screen.getByText('Delete Message')
    fireEvent.click(deleteOption)
    expect(mockOnDelete).toHaveBeenCalledWith(mockMessage.id)
  })

  it('shows retry option only for assistant messages', () => {
    const assistantMessage: StreamMessage = {
      ...mockMessage,
      role: 'assistant',
    }

    render(
      <MessageContextMenu message={assistantMessage} onDelete={mockOnDelete} onRetry={mockOnRetry}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    const button = screen.getByText('Test Button')
    fireEvent.contextMenu(button)
    expect(screen.getByText('Retry Response')).toBeInTheDocument()
  })

  it('does not show retry option for user messages', () => {
    render(
      <MessageContextMenu message={mockMessage} onDelete={mockOnDelete} onRetry={mockOnRetry}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    const button = screen.getByText('Test Button')
    fireEvent.contextMenu(button)
    expect(screen.queryByText('Retry Response')).not.toBeInTheDocument()
  })

  it('supports keyboard navigation', () => {
    render(
      <MessageContextMenu message={mockMessage} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </MessageContextMenu>
    )
    const button = screen.getByText('Test Button')
    
    // Test Shift + F10
    fireEvent.keyDown(button, { key: 'F10', shiftKey: true })
    expect(screen.getByText('Delete Message')).toBeInTheDocument()
    
    // Test Context Menu key
    fireEvent.keyDown(button, { key: 'ContextMenu' })
    expect(screen.getByText('Delete Message')).toBeInTheDocument()
    
    // Test Enter key on menu item
    const deleteOption = screen.getByText('Delete Message')
    fireEvent.keyDown(deleteOption, { key: 'Enter' })
    expect(mockOnDelete).toHaveBeenCalledWith(mockMessage.id)
  })
}) 