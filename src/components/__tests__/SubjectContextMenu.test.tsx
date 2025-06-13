import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SubjectContextMenu } from '../history/SubjectContextMenu'
import { Subject } from '@/types'

describe('SubjectContextMenu', () => {
  const mockSubject: Subject = {
    id: '1',
    name: 'Test Subject',
    progress: 0,
    color: 'bg-blue-500',
    isActive: true,
    startedAt: new Date(),
    topicKeywords: [],
    messageCount: 0,
    lastActive: new Date(),
  }

  const mockOnDelete = jest.fn()

  beforeEach(() => {
    mockOnDelete.mockClear()
  })

  it('renders children correctly', () => {
    render(
      <SubjectContextMenu subject={mockSubject} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </SubjectContextMenu>
    )
    expect(screen.getByText('Test Button')).toBeInTheDocument()
  })

  it('prevents default context menu behavior', () => {
    render(
      <SubjectContextMenu subject={mockSubject} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </SubjectContextMenu>
    )
    const button = screen.getByText('Test Button')
    const preventDefault = jest.fn()
    fireEvent.contextMenu(button, { preventDefault })
    expect(preventDefault).toHaveBeenCalled()
  })

  it('opens menu on right click', () => {
    render(
      <SubjectContextMenu subject={mockSubject} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </SubjectContextMenu>
    )
    const button = screen.getByText('Test Button')
    fireEvent.contextMenu(button)
    expect(screen.getByText('Delete Subject')).toBeInTheDocument()
  })

  it('calls onDelete when delete option is clicked', () => {
    render(
      <SubjectContextMenu subject={mockSubject} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </SubjectContextMenu>
    )
    const button = screen.getByText('Test Button')
    fireEvent.contextMenu(button)
    const deleteOption = screen.getByText('Delete Subject')
    fireEvent.click(deleteOption)
    expect(mockOnDelete).toHaveBeenCalledWith(mockSubject)
  })

  it('supports keyboard navigation', () => {
    render(
      <SubjectContextMenu subject={mockSubject} onDelete={mockOnDelete}>
        <button>Test Button</button>
      </SubjectContextMenu>
    )
    const button = screen.getByText('Test Button')
    
    // Test Shift + F10
    fireEvent.keyDown(button, { key: 'F10', shiftKey: true })
    expect(screen.getByText('Delete Subject')).toBeInTheDocument()
    
    // Test Context Menu key
    fireEvent.keyDown(button, { key: 'ContextMenu' })
    expect(screen.getByText('Delete Subject')).toBeInTheDocument()
    
    // Test Enter key on menu item
    const deleteOption = screen.getByText('Delete Subject')
    fireEvent.keyDown(deleteOption, { key: 'Enter' })
    expect(mockOnDelete).toHaveBeenCalledWith(mockSubject)
  })
}) 