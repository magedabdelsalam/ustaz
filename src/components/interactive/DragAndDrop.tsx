'use client'

/**
 * DragAndDrop
 * ----------------
 * TODO: Add description and exports for DragAndDrop.
 */


import { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, RotateCcw, Move } from 'lucide-react'

interface InteractiveComponentProps {
  onInteraction: (action: string, data: unknown) => void
  content: unknown
  id: string
}

interface DragAndDropContent {
  question: string
  instructions: string
  items: DragItem[]
  targets: DropTarget[]
  explanation: string
  category?: string
}

interface DragItem {
  id: string
  content: string
  correctTargetId: string
}

interface DropTarget {
  id: string
  label: string
  placeholder: string
}

export const DragAndDrop = memo(function DragAndDrop({ onInteraction, content, id }: InteractiveComponentProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  
  const dragContent = content as DragAndDropContent

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', itemId)
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDraggedItem(null)
    setDragOverTarget(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverTarget(targetId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the target (not entering a child)
    if (e.currentTarget === e.target) {
      setDragOverTarget(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverTarget(null)
    
    const itemId = e.dataTransfer.getData('text/plain') || draggedItem
    if (itemId) {
      // Remove any previous assignment of this item
      const newAssignments = { ...assignments }
      
      // If there's already an item in the target, swap them
      const existingItemInTarget = Object.keys(newAssignments).find(id => newAssignments[id] === targetId)
      const previousTarget = newAssignments[itemId]
      
      if (existingItemInTarget && previousTarget) {
        // Swap
        newAssignments[existingItemInTarget] = previousTarget
        newAssignments[itemId] = targetId
      } else {
        // Simple assignment
        newAssignments[itemId] = targetId
      }
      
      setAssignments(newAssignments)
      setDraggedItem(null)
    }
  }

  const handleRemoveAssignment = (itemId: string) => {
    if (showResult) return
    const newAssignments = { ...assignments }
    delete newAssignments[itemId]
    setAssignments(newAssignments)
  }

  const handleSubmit = () => {
    const newResults: Record<string, boolean> = {}
    
    dragContent.items.forEach(item => {
      const assignedTarget = assignments[item.id]
      newResults[item.id] = assignedTarget === item.correctTargetId
    })
    
    setResults(newResults)
    setShowResult(true)
    
    const score = Object.values(newResults).filter(Boolean).length
    const totalScore = dragContent.items.length
    
    onInteraction('drag_drop_submitted', {
      componentId: id,
      assignments,
      results: newResults,
      score,
      totalScore,
      allCorrect: score === totalScore
    })
  }

  const handleReset = () => {
    setAssignments({})
    setShowResult(false)
    setResults({})
    setDraggedItem(null)
    onInteraction('drag_drop_reset', { componentId: id })
  }

  const handleNewExercise = () => {
    onInteraction('next_exercise', {
      componentId: id,
      requestType: 'new_drag_drop',
      previousScore: {
        correct: Object.values(results).filter(Boolean).length,
        total: dragContent.items.length
      }
    })
  }

  const getUnassignedItems = () => {
    return dragContent.items.filter(item => !assignments[item.id])
  }

  const getAssignedItem = (targetId: string) => {
    const itemId = Object.keys(assignments).find(id => assignments[id] === targetId)
    return itemId ? dragContent.items.find(item => item.id === itemId) : null
  }

  return (
    <Card className="w-full mb-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <Move className="h-6 w-6 text-blue-600 mr-2" />
            {dragContent.category || 'Drag & Drop'}
          </CardTitle>
        </div>
        <p className="text-gray-600 text-base leading-relaxed mt-1">{dragContent.question}</p>
        <p className="text-sm text-gray-500">{dragContent.instructions}</p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Items to drag - Show unassigned items */}
        {getUnassignedItems().length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-lg text-gray-900">Drag these items to the correct targets:</h4>
            <div className="flex flex-wrap gap-3">
              {getUnassignedItems().map(item => (
                <div
                  key={item.id}
                  draggable={!showResult}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragEnd={handleDragEnd}
                  className={`px-4 py-3 bg-blue-100 border-2 border-blue-200 rounded-lg select-none transition-all ${
                    draggedItem === item.id ? 'opacity-50 scale-95' : ''
                  } ${
                    showResult
                      ? results[item.id]
                        ? 'bg-green-100 border-green-300'
                        : 'bg-red-100 border-red-300'
                      : 'hover:bg-blue-200 cursor-grab active:cursor-grabbing hover:shadow-md'
                  }`}
                >
                  <span className="text-base font-semibold">{item.content}</span>
                  {showResult && (
                    <span className="ml-3">
                      {results[item.id] ? (
                        <CheckCircle className="inline h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="inline h-5 w-5 text-red-600" />
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drop targets */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg text-gray-900">Drop targets:</h4>
          <div className="grid gap-4">
            {dragContent.targets.map(target => {
              const assignedItem = getAssignedItem(target.id)
              const isBeingDraggedOver = dragOverTarget === target.id
              
              return (
                <div
                  key={target.id}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, target.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, target.id)}
                  className={`min-h-[100px] p-4 border-2 border-dashed rounded-lg transition-all ${
                    isBeingDraggedOver
                      ? 'bg-blue-100 border-blue-500 border-solid scale-[1.02] shadow-lg'
                      : assignedItem
                      ? showResult
                        ? results[assignedItem.id]
                          ? 'bg-green-50 border-green-300'
                          : 'bg-red-50 border-red-300'
                        : 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-semibold text-gray-800">
                      {target.label}
                    </span>
                    {assignedItem && showResult && (
                      <span>
                        {results[assignedItem.id] ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-600" />
                        )}
                      </span>
                    )}
                  </div>
                  
                  {assignedItem ? (
                    <div
                      draggable={!showResult}
                      onDragStart={(e) => handleDragStart(e, assignedItem.id)}
                      onDragEnd={handleDragEnd}
                      className={`mt-2 px-4 py-3 bg-white rounded-lg border-2 shadow-sm flex items-center justify-between ${
                        !showResult ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all' : ''
                      } ${
                        showResult
                          ? results[assignedItem.id]
                            ? 'border-green-300 bg-green-50'
                            : 'border-red-300 bg-red-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <span className="text-base font-medium">{assignedItem.content}</span>
                      {!showResult && (
                        <button
                          onClick={() => handleRemoveAssignment(assignedItem.id)}
                          className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Remove from target"
                        >
                          <XCircle className="h-4 w-4 text-gray-600" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={`mt-2 p-4 text-center text-sm italic transition-colors ${
                      isBeingDraggedOver ? 'text-blue-600 font-medium' : 'text-gray-500'
                    }`}>
                      {isBeingDraggedOver ? '↓ Drop here' : target.placeholder}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Results explanation */}
        {showResult && (
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
            <h4 className="text-base font-semibold text-blue-900 mb-3">Explanation:</h4>
            <p className="text-blue-800 text-base leading-relaxed">{dragContent.explanation}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex space-x-3 pt-4">
          {!showResult ? (
            <Button 
              onClick={handleSubmit} 
              disabled={Object.keys(assignments).length !== dragContent.items.length}
              className="flex-1 text-base font-medium h-12"
            >
              Check Answers
            </Button>
          ) : (
            <div className="flex space-x-3 w-full">
              <Button onClick={handleNewExercise} className="flex-1 text-sm font-medium h-11">
                New Exercise
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1 text-sm font-medium h-11">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

// Placeholder components for future implementation
// These will be implemented in separate files when needed 