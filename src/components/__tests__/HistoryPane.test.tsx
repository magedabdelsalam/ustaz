import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { HistoryPane } from '../HistoryPane'
import { Subject } from '@/types'

describe('HistoryPane subject creation', () => {
  const baseSubjects: Subject[] = [
    {
      id: '1',
      name: 'Math',
      progress: 0,
      color: 'bg-blue-500',
      isActive: true,
      startedAt: new Date(),
      topicKeywords: [],
      messageCount: 0,
      lastActive: new Date(),
    },
  ]

  it('renders subject creation input', () => {
    render(
      <HistoryPane
        subjects={baseSubjects}
        selectedSubject={baseSubjects[0]}
        user={null}
      />
    )
    expect(screen.getByPlaceholderText('Create new subject...')).toBeInTheDocument()
    expect(screen.getByLabelText('Add subject')).toBeInTheDocument()
  })

  it('calls onSubjectCreate with new subject name', async () => {
    const onSubjectCreate = jest.fn().mockResolvedValue(undefined)
    render(
      <HistoryPane
        subjects={baseSubjects}
        selectedSubject={baseSubjects[0]}
        user={null}
        onSubjectCreate={onSubjectCreate}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Create new subject...'), { target: { value: 'Science' } })
    fireEvent.click(screen.getByLabelText('Add subject'))
    await waitFor(() => expect(onSubjectCreate).toHaveBeenCalledWith('Science'))
  })

  it('shows error for empty subject name', async () => {
    render(
      <HistoryPane
        subjects={baseSubjects}
        selectedSubject={baseSubjects[0]}
        user={null}
      />
    )
    const inputs = screen.getAllByPlaceholderText('Create new subject...')
    expect(inputs.length).toBe(1)
    fireEvent.change(inputs[0], { target: { value: ' ' } })
    fireEvent.click(screen.getByLabelText('Add subject'))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('cannot be empty')
    })
  })

  it('shows error for duplicate subject name', async () => {
    render(
      <HistoryPane
        subjects={baseSubjects}
        selectedSubject={baseSubjects[0]}
        user={null}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Create new subject...'), { target: { value: 'Math' } })
    fireEvent.click(screen.getByLabelText('Add subject'))
    expect(await screen.findByRole('alert')).toHaveTextContent('must be unique')
  })

  it('shows loading state when creating', async () => {
    let resolve: () => void
    const onSubjectCreate = jest.fn(() => new Promise<void>(r => { resolve = r }))
    render(
      <HistoryPane
        subjects={baseSubjects}
        selectedSubject={baseSubjects[0]}
        user={null}
        onSubjectCreate={onSubjectCreate}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Create new subject...'), { target: { value: 'Science' } })
    fireEvent.click(screen.getByLabelText('Add subject'))
    expect(screen.getByLabelText('Add subject')).toHaveTextContent('Creating...')
    // Finish promise
    resolve!()
    await waitFor(() => expect(screen.getByLabelText('Add subject')).toHaveTextContent('Add'))
  })

  it('input and button are accessible by keyboard', () => {
    render(
      <HistoryPane
        subjects={baseSubjects}
        selectedSubject={baseSubjects[0]}
        user={null}
      />
    )
    const input = screen.getByPlaceholderText('Create new subject...')
    input.focus()
    fireEvent.change(input, { target: { value: 'Biology' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })
    // No error should be shown for valid input
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
}) 