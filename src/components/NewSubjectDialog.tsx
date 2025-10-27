'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

interface NewSubjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    learningGoals: string[]
    estimatedDuration: string
  }) => void
  isLoading?: boolean
}

export function NewSubjectDialog({ isOpen, onClose, onSubmit, isLoading }: NewSubjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [learningGoals, setLearningGoals] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState('')

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setDescription('')
      setDifficulty('beginner')
      setLearningGoals('')
      setEstimatedDuration('')
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isLoading) return

    // Parse learning goals (comma-separated or newline-separated)
    const goals = learningGoals
      .split(/[,\n]/)
      .map(g => g.trim())
      .filter(g => g.length > 0)

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      difficulty,
      learningGoals: goals.length > 0 ? goals : [`Learn ${name} fundamentals`, `Practice ${name} concepts`, `Master ${name} skills`],
      estimatedDuration: estimatedDuration.trim() || '2 weeks'
    })
  }

  const handleClose = () => {
    if (isLoading) return
    onClose()
  }

  // Don't render anything if not open
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div 
        className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Create New Subject</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Subject Name */}
            <div className="space-y-2">
              <label htmlFor="subject-name" className="text-sm font-medium text-gray-900">
                Subject Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="subject-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Algebra, World History, Python"
                disabled={isLoading}
                required
                className="w-full"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-gray-900">
                What would you like to learn?
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you want to learn in this subject..."
                disabled={isLoading}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Difficulty Level */}
            <div className="space-y-2">
              <label htmlFor="difficulty" className="text-sm font-medium text-gray-900">
                Difficulty Level <span className="text-red-500">*</span>
              </label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                disabled={isLoading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="beginner">Beginner - New to this subject</option>
                <option value="intermediate">Intermediate - Some knowledge</option>
                <option value="advanced">Advanced - Deep understanding</option>
              </select>
            </div>

            {/* Learning Goals */}
            <div className="space-y-2">
              <label htmlFor="learning-goals" className="text-sm font-medium text-gray-900">
                Learning Goals (Optional)
              </label>
              <textarea
                id="learning-goals"
                value={learningGoals}
                onChange={(e) => setLearningGoals(e.target.value)}
                placeholder="Enter specific topics or goals, separated by commas or new lines..."
                disabled={isLoading}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500">
                Leave blank to let AI generate goals based on your subject
              </p>
            </div>

            {/* Estimated Duration */}
            <div className="space-y-2">
              <label htmlFor="duration" className="text-sm font-medium text-gray-900">
                Estimated Duration (Optional)
              </label>
              <Input
                id="duration"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="e.g., 2 weeks, 1 month, 3 months"
                disabled={isLoading}
                className="w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 'Creating...' : 'Create Subject & Generate Plan'}
              </Button>
            </div>
          </form>
      </div>
    </div>
  )
}

